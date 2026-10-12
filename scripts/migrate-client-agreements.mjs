import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const mode = process.argv[2] || 'check';
const migrationVersion = '015_client_agreements';
const hash = value => createHash('sha256').update(value).digest('hex');
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const artifactDirectory = path.join(root, 'project-backups', 'agreement-flow-2026-10-02', 'migration');
const artifact = name => path.join(artifactDirectory, name);
const tables = [
  'properties', 'property_translations', 'property_share_settings', 'company_payment_methods',
  'property_requests', 'payment_requests', 'payment_refunds', 'deposit_submissions',
  'wallet_accounts', 'wallet_transactions', 'property_holdings', 'admin_audit_logs',
];

async function main() {
  assert.ok(['check', 'apply', 'verify'].includes(mode), 'Use check, apply or verify.');
  process.loadEnvFile(path.join(root, '.env'));
  const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  assert.ok(/^[a-z0-9]+$/.test(project), 'Invalid Supabase project reference.');
  assert.ok(token, 'SUPABASE_ACCESS_TOKEN is required.');
  mkdirSync(artifactDirectory, { recursive: true });

  async function query(sql, readOnly = true) {
    const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query: sql, read_only: readOnly }),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) {
      // Never print an API response body, SQL statement, environment or token.
      const body = await response.text();
      const sqlState = body.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1];
      const agreementError = body.match(/\b(?:AGREEMENT_[A-Z_]+|fixture_agreement_audit_failure)\b/)?.[0];
      throw new Error(`Database request failed (HTTP ${response.status}${sqlState ? `; SQLSTATE ${sqlState}` : ''}${agreementError ? `; ${agreementError}` : ''}).`);
    }
    return response.json();
  }

  const manifest = JSON.parse(readFileSync(path.join(root, 'app/lib/agreement-manifest.json'), 'utf8'));
  assert.match(manifest.version, /^[a-zA-Z0-9-]{1,100}$/);
  assert.deepEqual(manifest.documents.map(document => document.locale).sort(), ['de', 'en', 'es', 'fr', 'it']);
  const seed = manifest.documents.map(document => {
    const expectedPath = `/documents/agreements/${manifest.version}/${document.locale}.pdf`;
    assert.equal(document.path, expectedPath, 'Archived PDF path must match its immutable version and locale.');
    assert.match(document.sha256, /^[a-f0-9]{64}$/);
    assert.equal(typeof document.isDraft, 'boolean');
    assert.equal(typeof document.consentText, 'string');
    assert.ok(document.consentText.length >= 10 && document.consentText.length <= 2000 && !document.consentText.includes('\0'));
    const pdf = readFileSync(path.join(root, 'public', ...expectedPath.slice(1).split('/')));
    assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-', 'Archived document must be a PDF.');
    assert.equal(hash(pdf), document.sha256, `Archived ${document.locale} PDF checksum mismatch.`);
    const values = [manifest.version, document.locale, document.path, document.sha256, document.consentText].map(literal);
    return `
do $catalog$ begin
  if exists(select 1 from public.client_agreement_versions where version = ${values[0]} and locale = ${values[1]}
    and (document_path, document_sha256, consent_text, is_draft)
      is distinct from (${values[2]}, ${values[3]}, ${values[4]}, ${document.isDraft})) then
    raise exception 'AGREEMENT_CATALOG_CHECKSUM_MISMATCH';
  end if;
end $catalog$;
insert into public.client_agreement_versions(version, locale, document_path, document_sha256, consent_text, is_draft, active)
values (${values.join(', ')}, ${document.isDraft}, true) on conflict (version, locale) do nothing;`;
  }).join('\n');
  const migration = readFileSync(path.join(root, 'SUPABASE_CLIENT_AGREEMENTS.sql'), 'utf8');
  const tests = readFileSync(path.join(root, 'scripts/tests/client-agreements.sql'), 'utf8');
  assert.doesNotMatch(migration + '\n' + tests, /^\s*(?:begin|commit|rollback)\s*;/im,
    'Migration and tests must not control the outer transaction.');
  const migrationHash = hash(migration + '\n' + seed);
  const testsHash = hash(tests);

  async function snapshot() {
    const [catalog] = await query(`select
      to_regclass('public.client_agreement_acceptances') is not null as installed,
      (select md5(coalesce(jsonb_agg(to_jsonb(c) order by c.relname), '[]'::jsonb)::text)
        from (select relname, relrowsecurity, relacl::text from pg_class
          where oid in (to_regclass('public.client_agreement_versions'), to_regclass('public.client_agreement_acceptances'))) c) as tables,
      (select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.policyname), '[]'::jsonb)::text)
        from pg_policies p where schemaname = 'public' and tablename in ('client_agreement_versions', 'client_agreement_acceptances')) as policies,
      (select md5(coalesce(jsonb_agg(jsonb_build_object('name', proname, 'definition', pg_get_functiondef(p.oid), 'acl', proacl::text) order by proname), '[]'::jsonb)::text)
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and proname in ('is_client_agreement_admin', 'protect_client_agreement_version', 'protect_client_agreement_acceptance', 'accept_client_agreement', 'review_client_agreement')) as functions`);
    const existingTables = [...tables.map(table => `public.${table}`), 'auth.users'];
    if (catalog.installed) existingTables.push('public.client_agreement_acceptances');
    const [records] = await query(`select ${existingTables.map(table =>
      `(select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb)::text) from ${table} t) as ${table.split('.')[1]}`
    ).join(',')}`);
    records.client_agreement_acceptances ??= createHash('md5').update('[]').digest('hex');
    return { catalog, records };
  }

  async function verifyCatalog() {
    const rows = await query(`select version, locale, document_path, document_sha256, consent_text, is_draft, active
      from public.client_agreement_versions where version = ${literal(manifest.version)} order by locale`);
    assert.deepEqual(rows, manifest.documents.map(document => ({
      version: manifest.version, locale: document.locale, document_path: document.path,
      document_sha256: document.sha256, consent_text: document.consentText,
      is_draft: document.isDraft, active: true,
    })).sort((left, right) => left.locale.localeCompare(right.locale)), 'Installed document catalog must match the archived PDF manifest.');
    const [registry] = await query(`select checksum from public.brickwise_schema_migrations where version = ${literal(migrationVersion)}`);
    assert.equal(registry?.checksum, migrationHash, 'Installed migration checksum differs.');
  }

  const before = await snapshot();
  const transactionStart = "begin; set local lock_timeout = '5s'; set local statement_timeout = '35s'; select pg_advisory_xact_lock(hashtextextended('brickwise-wallet-migrations', 0));";
  const checksumGuard = `do $checksum$ begin
    if exists(select 1 from public.brickwise_schema_migrations where version = ${literal(migrationVersion)} and checksum <> ${literal(migrationHash)}) then
      raise exception 'AGREEMENT_MIGRATION_CHECKSUM_MISMATCH';
    end if;
  end $checksum$;`;

  if (mode === 'check' || mode === 'verify') {
    const [authTriggers] = await query("select count(*)::integer as count from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal");
    assert.equal(authTriggers.count, 0, 'Review custom auth.users triggers before running rollback-only account fixtures.');
    if (mode === 'verify') await verifyCatalog();
    const setup = mode === 'check' ? `${checksumGuard}\n${migration}\n${seed}\n${migration}\n${seed}` : '';
    await query(`${transactionStart}\n${setup}\n${tests}\nrollback;`, false);
    assert.deepEqual(await snapshot(), before, 'Rollback verification failed: database state changed.');
    if (mode === 'check') {
      writeFileSync(artifact('checked.json'), JSON.stringify({
        project, migrationHash, testsHash, catalogHash: hash(JSON.stringify(before.catalog)),
        checkedAt: new Date().toISOString(), assertionsPassed: true, rollbackVerified: true,
      }, null, 2));
    }
    console.log(`PASS: ${mode}; archived PDF hashes, real RLS/RPC access, explicit consent, immutable snapshots, retries and atomic review/audit; all fixtures rolled back.`);
  } else {
    const check = JSON.parse(readFileSync(artifact('checked.json'), 'utf8'));
    assert.equal(check.project, project);
    assert.equal(check.migrationHash, migrationHash, 'Run check after migration or document changes.');
    assert.equal(check.testsHash, testsHash, 'Run check after test changes.');
    assert.equal(check.catalogHash, hash(JSON.stringify(before.catalog)), 'Database agreement schema changed; run check again.');
    assert.ok(check.assertionsPassed && check.rollbackVerified);
    assert.ok(Date.now() - Date.parse(check.checkedAt) < 60 * 60 * 1000, 'Run a fresh check before apply.');
    writeFileSync(artifact('before.json'), JSON.stringify(before, null, 2));
    await query(`${transactionStart}\n${checksumGuard}\n${migration}\n${seed}
      insert into public.brickwise_schema_migrations(version, checksum, mode)
      values (${literal(migrationVersion)}, ${literal(migrationHash)}, 'applied') on conflict (version) do nothing;
      commit;`, false);
    await verifyCatalog();
    assert.deepEqual((await snapshot()).records, before.records, 'Existing business records changed during migration.');
    writeFileSync(artifact('applied.json'), JSON.stringify({
      project, migrationHash, testsHash, documentVersion: manifest.version,
      appliedAt: new Date().toISOString(), existingBusinessRecordsUnchanged: true,
    }, null, 2));
    console.log('PASS: agreement schema and five versioned documents applied; existing business records unchanged.');
  }
}

main().catch(error => {
  // Assertion messages describe invariants only; never log values or a stack.
  console.error(error.code === 'ERR_ASSERTION' ? error.message.split('\n')[0] : error.message);
  process.exitCode = 1;
});

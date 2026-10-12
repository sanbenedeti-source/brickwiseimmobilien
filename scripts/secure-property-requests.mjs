import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
process.loadEnvFile(path.join(root, ".env"));
const mode = process.argv[2] || "check";
assert.ok(["check", "apply", "verify"].includes(mode), "Use check, apply or verify.");
const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const token = process.env.SUPABASE_ACCESS_TOKEN;
assert.ok(token, "SUPABASE_ACCESS_TOKEN is required.");
const migration = readFileSync(path.join(root, "SUPABASE_PROPERTY_REQUESTS_RLS.sql"), "utf8");
const testsPath = path.join(root, "scripts/tests/property-requests-rls.sql");
const artifact = (name) => path.join(root, ".next", name);
mkdirSync(path.join(root, ".next"), { recursive: true });
const hash = (value) => createHash("sha256").update(value).digest("hex");

async function query(sql, readOnly = true) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query: sql, read_only: readOnly }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) {
    const detail = (await response.text())
      .replaceAll(token, "[redacted]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+/gi, "[email]");
    throw new Error(`Database HTTP ${response.status}: ${detail.slice(0, 1500)}`);
  }
  return response.json();
}

const snapshotSql = `
select json_build_object(
  'catalog', json_build_object(
    'policies', (select json_agg(row_to_json(p) order by p.policyname)
      from (select policyname, permissive, roles, cmd, qual, with_check
        from pg_policies where schemaname='public' and tablename='property_requests') p),
    'table', (select json_build_object('rls',relrowsecurity,'acl',relacl::text)
      from pg_class where oid='public.property_requests'::regclass),
    'column_acl', (select json_agg(json_build_object('column',attname,'acl',attacl::text) order by attname)
      from pg_attribute where attrelid='public.property_requests'::regclass and attacl is not null)
  ),
  'records', (select json_build_object('count',count(*),
    'checksum',md5(coalesce(string_agg(row_to_json(r)::text,'' order by r.id),'')))
    from public.property_requests r),
  'custom_triggers', (select count(*) from pg_trigger
    where tgrelid in ('auth.users'::regclass,'public.property_requests'::regclass) and not tgisinternal),
  'privileges', json_build_object(
    'anon_read',has_table_privilege('anon','public.property_requests','SELECT'),
    'anon_insert',has_column_privilege('anon','public.property_requests','message','INSERT'),
    'anon_update',has_any_column_privilege('anon','public.property_requests','UPDATE'),
    'user_status_update',has_column_privilege('authenticated','public.property_requests','status','UPDATE'),
    'user_owner_update',has_column_privilege('authenticated','public.property_requests','user_id','UPDATE'),
    'user_insert_id',has_column_privilege('authenticated','public.property_requests','id','INSERT'),
    'anon_delete',has_table_privilege('anon','public.property_requests','DELETE'),
    'user_delete',has_table_privilege('authenticated','public.property_requests','DELETE'),
    'anon_truncate',has_table_privilege('anon','public.property_requests','TRUNCATE'),
    'user_truncate',has_table_privilege('authenticated','public.property_requests','TRUNCATE'),
    'service_insert',has_table_privilege('service_role','public.property_requests','INSERT')
  )
) as snapshot`;
async function snapshot() { return (await query(snapshotSql))[0].snapshot; }

function verifyCatalog(state) {
  assert.equal(state.catalog.table.rls, true);
  assert.deepEqual(state.catalog.policies.map(p => p.policyname).sort(), [
    "Client request input limits", "Customers create own new requests",
    "Customers read own requests",
    "Role administrators read property requests",
    "Role administrators update request status", "Visitors create new unlinked requests",
  ].sort());
  assert.deepEqual(state.privileges, {
    anon_read: false, anon_insert: true, anon_update: false,
    user_status_update: true, user_owner_update: false, user_insert_id: false,
    anon_delete: false, user_delete: false, anon_truncate: false,
    user_truncate: false, service_insert: true,
  });
}

try {
  const before = await snapshot();
  if (mode === "check") {
    assert.equal(before.custom_triggers, 0,
      "Review custom auth/request triggers before running rollback-only fixtures.");
    const tests = readFileSync(testsPath, "utf8");
    const body = migration.replace(/^begin;\s*$/m, "").replace(/^commit;\s*$/m, "");
    assert.doesNotMatch(tests, /^\s*(?:begin|commit|rollback)\s*;/im,
      "The test fixture file must not control the outer transaction.");
    // Two applications exercise repeatability. All policy changes, auth fixtures
    // and request fixtures disappear at ROLLBACK; no auth service/email is called.
    await query(`begin;\n${body}\n${body}\n${tests}\nrollback;\nselect true as assertions_passed;`, false);
    const after = await snapshot();
    assert.deepEqual(after.catalog, before.catalog, "Policy dry run must roll back.");
    assert.deepEqual(after.records, before.records, "Request data must stay unchanged.");
    writeFileSync(artifact("property-requests-security-check.json"), JSON.stringify({
      project, migrationHash: hash(migration), testsHash: hash(tests),
      catalogHash: hash(JSON.stringify(before.catalog)), checkedAt: new Date().toISOString(),
      assertionsPassed: true, rollbackVerified: true,
    }, null, 2));
    console.log("PASS: real database role assertions; migration applied twice and rolled back; existing requests unchanged.");
  } else if (mode === "apply") {
    const check = JSON.parse(readFileSync(artifact("property-requests-security-check.json"), "utf8"));
    assert.equal(check.project, project);
    assert.equal(check.migrationHash, hash(migration), "Run check after migration changes.");
    assert.equal(check.testsHash, hash(readFileSync(testsPath, "utf8")));
    assert.equal(check.catalogHash, hash(JSON.stringify(before.catalog)), "Database policies changed; run check again.");
    assert.ok(Date.now() - Date.parse(check.checkedAt) < 60 * 60 * 1000, "Run a fresh check first.");
    writeFileSync(artifact("property-requests-security-before.json"), JSON.stringify(before, null, 2));
    await query(migration, false);
    const after = await snapshot();
    verifyCatalog(after);
    assert.deepEqual(after.records, before.records, "Existing requests changed during deployment; inspect before continuing.");
    writeFileSync(artifact("property-requests-security-applied.json"), JSON.stringify({
      appliedAt: new Date().toISOString(), migrationHash: hash(migration),
      policies: after.catalog.policies.map(p => p.policyname),
      privileges: after.privileges, existingRequestsUnchanged: true,
    }, null, 2));
    console.log("PASS: production request policies applied; least-privilege grants verified; existing requests unchanged.");
  } else {
    verifyCatalog(before);
    console.log("PASS: production policy names, RLS and column/table privileges verified.");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}


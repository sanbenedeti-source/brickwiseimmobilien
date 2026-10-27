import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { signaturePng, signaturePngBytes } from '../../scripts/tests/signature-fixture.mjs';

const require = createRequire(import.meta.url);
const { PDFDocument } = require('pdf-lib');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function compile(path, modules = {}) {
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    assert.ok(name in modules, `Unexpected dependency: ${name}`);
    return modules[name];
  }, loaded, loaded.exports);
  return loaded.exports;
}

const manifest = JSON.parse(readFileSync('app/lib/agreement-manifest.json', 'utf8'));
const english = manifest.documents.find(document => document.locale === 'en');
const original = new Uint8Array(readFileSync(`public${english.path}`));
const pdfModule = compile('app/lib/signed-agreement-pdf.ts', { 'pdf-lib': require('pdf-lib') });
const userId = '11111111-1111-4111-8111-111111111111';

test('only a plausible PNG data URL from the signature pad is accepted', () => {
  assert.ok(pdfModule.parseSignaturePng(signaturePng()) instanceof Uint8Array);
  for (const value of [undefined, null, 42, '', 'data:image/jpeg;base64,AAAA', 'data:image/png;base64,***',
    'data:image/png;base64,' + Buffer.from('plain text pretending to be a png file').toString('base64'),
    signaturePng({ width: 40, height: 20 }), signaturePng({ width: 4000, height: 300 }),
    'data:image/png;base64,' + 'A'.repeat(300_000)]) {
    assert.equal(pdfModule.parseSignaturePng(value), null, String(value).slice(0, 40));
  }
});

test('names outside the PDF standard font charset degrade to readable text instead of failing', () => {
  assert.equal(pdfModule.pdfSafeText('Zoë Łukasz Ştefan Ørsted'), 'Zoë Lukasz Stefan Ørsted');
  assert.equal(pdfModule.pdfSafeText('Иван\nLine'), '???? Line');
});

test('the signed PDF keeps every original page and appends one evidence page', async () => {
  const signedAt = new Date('2026-10-24T12:34:56Z');
  const bytes = await pdfModule.buildSignedAgreementPdf(original, {
    acceptanceId: '22222222-2222-4222-8222-222222222222', signerName: 'Anna Müller', email: 'anna@example.invalid',
    signedAt, ip: '203.0.113.7', userAgent: 'Fixture Browser/1.0 ' + 'x'.repeat(200), version: manifest.version, locale: 'en',
    documentSha256: english.sha256, consentText: english.consentText, signaturePng: signaturePngBytes(),
  });
  const before = await PDFDocument.load(original);
  const after = await PDFDocument.load(bytes);
  assert.equal(after.getPageCount(), before.getPageCount() + 1);
  const { width, height } = after.getPage(after.getPageCount() - 1).getSize();
  assert.deepEqual([Math.round(width), Math.round(height)], [595, 842]);
  assert.match(after.getTitle(), /Anna Müller/);
  assert.match(after.getKeywords(), /22222222-2222-4222-8222-222222222222/);
  assert.match(after.getKeywords(), new RegExp(english.sha256));
  assert.equal(pdfModule.formatUtc(signedAt), '2026-10-24 12:34:56 UTC');
  // Non-Latin names and a missing IP must not break generation.
  const fallback = await pdfModule.buildSignedAgreementPdf(original, {
    acceptanceId: '33333333-3333-4333-8333-333333333333', signerName: 'Иван Петров', email: 'ivan@example.invalid',
    signedAt, ip: null, userAgent: null, version: manifest.version, locale: 'de', documentSha256: english.sha256,
    consentText: english.consentText, signaturePng: signaturePngBytes(),
  });
  assert.equal((await PDFDocument.load(fallback)).getPageCount(), before.getPageCount() + 1);
});

function signingHarness(options = {}) {
  const calls = [];
  const admin = {
    storage: {
      from(bucket) {
        assert.equal(bucket, 'client-agreements');
        return {
          async upload(path, bytes, settings) { calls.push(['upload', path, bytes, settings]); return { error: options.uploadError || null }; },
          async remove(paths) { calls.push(['remove', paths]); return { error: null }; },
          async download(path) { calls.push(['download', path]); return options.download || { data: new Blob([options.stored || new Uint8Array()]), error: null }; },
        };
      },
    },
    async rpc(name, args) { calls.push(['rpc', name, args]); return options.rpc ? options.rpc(args) : { data: args.p_id, error: null }; },
  };
  const signing = compile('app/lib/agreement-signing.ts', {
    'node:crypto': require('node:crypto'), 'node:fs/promises': require('node:fs/promises'), 'node:path': require('node:path'),
    '@supabase/supabase-js': { createClient: () => admin },
    './signed-agreement-pdf': pdfModule,
  });
  const input = {
    userId, email: 'anna@example.invalid', signerName: 'Anna Müller', locale: 'en',
    document: { version: manifest.version, path: english.path, sha256: english.sha256, consentText: english.consentText },
    signaturePng: signaturePngBytes(), ip: '203.0.113.7', userAgent: 'Fixture Browser',
    ...options.input,
  };
  return { calls, signing, input };
}

function withServiceEnvironment(run) {
  const previous = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-only';
  return run().finally(() => {
    for (const [name, value] of [['NEXT_PUBLIC_SUPABASE_URL', previous.url], ['SUPABASE_SERVICE_ROLE_KEY', previous.key]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
}

test('signing stores the PDF privately, then records its checksums with the signature evidence', () => withServiceEnvironment(async () => {
  const h = signingHarness();
  const id = await h.signing.signAgreement(h.input);
  const [upload, rpc] = h.calls;
  assert.equal(upload[0], 'upload');
  assert.equal(upload[1], `${userId}/${id}.pdf`);
  assert.deepEqual(upload[3], { contentType: 'application/pdf', upsert: false });
  assert.equal(rpc[1], 'sign_client_agreement');
  assert.equal(rpc[2].p_id, id);
  assert.equal(rpc[2].p_user_id, userId);
  assert.equal(rpc[2].p_signed_pdf_sha256, sha256(upload[2]));
  assert.equal(rpc[2].p_signature_sha256, sha256(h.input.signaturePng));
  assert.equal(rpc[2].p_consent, true);
  assert.equal(rpc[2].p_signer_ip, '203.0.113.7');
  assert.ok(Math.abs(Date.parse(rpc[2].p_signed_at) - Date.now()) < 60_000);
  assert.equal(h.calls.some(([name]) => name === 'remove'), false);
}));

test('a failed or duplicate recording removes the uploaded PDF', () => withServiceEnvironment(async () => {
  const failed = signingHarness({ rpc: () => ({ data: null, error: { message: 'AGREEMENT_SIGNED_PDF_MISSING' } }) });
  await assert.rejects(failed.signing.signAgreement(failed.input));
  assert.deepEqual(failed.calls.at(-1), ['remove', [failed.calls[0][1]]]);
  const existing = '44444444-4444-4444-8444-444444444444';
  const duplicate = signingHarness({ rpc: () => ({ data: existing, error: null }) });
  assert.equal(await duplicate.signing.signAgreement(duplicate.input), existing);
  assert.deepEqual(duplicate.calls.at(-1), ['remove', [duplicate.calls[0][1]]]);
}));

test('a changed archive, unexpected path, failed upload or missing configuration never records a signature', async () => {
  await withServiceEnvironment(async () => {
    for (const input of [
      { document: { version: manifest.version, path: english.path, sha256: 'f'.repeat(64), consentText: english.consentText } },
      { document: { version: manifest.version, path: '/documents/agreements/../../.env', sha256: english.sha256, consentText: english.consentText } },
    ]) {
      const h = signingHarness({ input });
      await assert.rejects(h.signing.signAgreement(h.input));
      assert.equal(h.calls.length, 0);
    }
    const upload = signingHarness({ uploadError: { message: 'Bucket not found' } });
    await assert.rejects(upload.signing.signAgreement(upload.input));
    assert.deepEqual(upload.calls.map(([name]) => name), ['upload']);
  });
  const unconfigured = signingHarness();
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    await assert.rejects(unconfigured.signing.signAgreement(unconfigured.input));
    assert.equal(unconfigured.calls.length, 0);
  } finally { if (previous !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = previous; }
});

test('a stored signed PDF is served only while it matches its recorded checksum', () => withServiceEnvironment(async () => {
  const stored = new Uint8Array([37, 80, 68, 70, 45, 49]);
  const path = `${userId}/22222222-2222-4222-8222-222222222222.pdf`;
  const ok = signingHarness({ stored });
  assert.deepEqual(await ok.signing.readSignedAgreement(path, sha256(stored)), stored);
  const tampered = signingHarness({ stored });
  await assert.rejects(tampered.signing.readSignedAgreement(path, 'a'.repeat(64)));
  const traversal = signingHarness({ stored });
  await assert.rejects(traversal.signing.readSignedAgreement('../secrets.pdf', sha256(stored)));
  assert.equal(traversal.calls.length, 0);
}));

function downloadHarness(options = {}) {
  const queries = [], reads = [];
  const owner = { id: userId, email: 'anna@example.invalid', app_metadata: {} };
  const row = { id: '22222222-2222-4222-8222-222222222222', user_id: userId, version: manifest.version,
    signed_pdf_path: `${userId}/22222222-2222-4222-8222-222222222222.pdf`, signed_pdf_sha256: 'b'.repeat(64) };
  const client = {
    auth: { getUser: async () => ({ data: { user: options.user === undefined ? owner : options.user }, error: null }) },
    from(table) {
      const query = { table, filters: [] };
      queries.push(query);
      return {
        select(columns) { query.columns = columns; return this; },
        eq(column, value) { query.filters.push([column, value]); return this; },
        maybeSingle: async () => ({ data: options.row === undefined ? row : options.row, error: options.error || null }),
      };
    },
  };
  const { GET } = compile('app/api/client-agreements/[id]/signed/route.ts', {
    '@/lib/supabase/server': { createClient: async () => client },
    '@/app/lib/admin': { isAdminUser: user => user?.app_metadata?.role === 'admin' },
    '@/app/lib/admin-session': { hasAdminSession: async () => options.adminSession ?? false },
    '@/app/lib/agreement-signing': { readSignedAgreement: async (path, hash) => {
      reads.push([path, hash]);
      if (options.readFails) throw new Error('integrity');
      return new Uint8Array([37, 80, 68, 70]);
    } },
  });
  const get = (id = row.id, query = '') => GET(new Request(`https://www.brickwise-immo.de/api/client-agreements/${id}/signed${query}`), { params: Promise.resolve({ id }) });
  return { queries, reads, get, row };
}

test('signed PDF download is limited to the owner or a fully signed-in administrator', async () => {
  assert.equal((await downloadHarness({ user: null }).get()).status, 401);
  const invalid = downloadHarness();
  assert.equal((await invalid.get('../../etc')).status, 404);
  assert.equal(invalid.queries.length, 0);
  assert.equal((await downloadHarness({ row: null }).get()).status, 404);
  assert.equal((await downloadHarness({ row: { id: 'x', user_id: userId, version: 'v', signed_pdf_path: null, signed_pdf_sha256: null } }).get()).status, 404);
  const stranger = downloadHarness({ user: { id: '99999999-9999-4999-8999-999999999999', app_metadata: {} } });
  assert.equal((await stranger.get()).status, 404);
  assert.equal(stranger.reads.length, 0);
  const adminWithoutMfa = downloadHarness({ user: { id: 'admin', app_metadata: { role: 'admin' } }, adminSession: false });
  assert.equal((await adminWithoutMfa.get()).status, 404);
  assert.equal(adminWithoutMfa.reads.length, 0);
  const admin = downloadHarness({ user: { id: 'admin', app_metadata: { role: 'admin' } }, adminSession: true });
  const viewed = await admin.get(undefined, '?view=1');
  assert.equal(viewed.status, 200);
  assert.match(viewed.headers.get('content-disposition'), /^inline; filename="brickwise-agreement-/);
  const owner = downloadHarness();
  const response = await owner.get();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(response.headers.get('content-disposition'), /^attachment; filename="brickwise-agreement-/);
  assert.deepEqual(owner.reads, [[owner.row.signed_pdf_path, owner.row.signed_pdf_sha256]]);
  assert.equal((await downloadHarness({ readFails: true }).get()).status, 503);
  assert.equal((await downloadHarness({ error: { message: 'db' } }).get()).status, 503);
});

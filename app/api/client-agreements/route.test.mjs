import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

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
const i18n = compile('app/lib/i18n.ts');
const agreements = compile('app/lib/client-agreements.ts', { './agreement-manifest.json': manifest });
const origin = 'https://www.brickwise-immo.de';
const user = { id: 'customer-fixture', email: 'customer@example.invalid', email_confirmed_at: '2026-10-01T12:00:00Z' };
const validInput = { version: manifest.version, locale: 'en', signerName: 'Fixture Customer', consent: true };

function harness(options = {}) {
  const queries = [], writes = [];
  let authCalls = 0, acceptance = options.acceptance || null;
  const authUser = options.user === undefined ? user : options.user;
  const client = {
    auth: { getUser: async () => { authCalls++; return { data: { user: authUser }, error: options.authError || null }; } },
    from(table) {
      const query = { table, filters: [] };
      queries.push(query);
      return {
        select(columns) { query.columns = columns; return this; },
        eq(column, value) { query.filters.push([column, value]); return this; },
        async maybeSingle() {
          if (options.storageError) return { data: null, error: { message: 'Storage unavailable' } };
          if (table === 'client_agreement_acceptances') return { data: acceptance, error: null };
          assert.equal(table, 'client_agreement_versions');
          const locale = query.filters.find(([key]) => key === 'locale')?.[1];
          const document = manifest.documents.find(item => item.locale === locale);
          return { error: null, data: options.missingDocument ? null : {
            version: manifest.version, locale,
            document_path: document.path, document_sha256: document.sha256,
            consent_text: document.consentText, is_draft: document.isDraft,
            ...options.documentPatch,
          } };
        },
      };
    },
    async rpc(name, args) {
      writes.push({ name, args });
      if (options.rpcThrows) throw new Error('Connection interrupted');
      if (options.rpcError) return { data: null, error: options.rpcError };
      const document = manifest.documents.find(item => item.locale === args.p_locale);
      acceptance ||= {
        id: 'acceptance-fixture', user_id: authUser.id, email: authUser.email,
        signer_name: args.p_signer_name, version: args.p_version, locale: args.p_locale,
        document_path: document.path, document_sha256: document.sha256,
        consent_text: document.consentText, is_draft: document.isDraft,
        accepted_at: '2026-10-02T12:00:00Z', status: 'pending',
        reviewed_by: null, reviewed_at: null, review_note: null,
      };
      return { data: acceptance, error: null };
    },
  };
  const routes = compile('app/api/client-agreements/route.ts', {
    '@/lib/supabase/server': { createClient: async () => {
      if (options.clientError) throw new Error('Configuration unavailable');
      return client;
    } },
    '@/app/lib/i18n': i18n,
    '@/app/lib/client-agreements': agreements,
  });
  return {
    queries, writes, get authCalls() { return authCalls; },
    get: (suffix = '', headers = {}) => routes.GET(new Request(`${origin}/api/client-agreements${suffix}`, { headers })),
    post: (body = validInput, { raw, headers = {} } = {}) => routes.POST(new Request(`${origin}/api/client-agreements`, {
      method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers },
      body: raw === undefined ? JSON.stringify(body) : raw,
    })),
  };
}

async function expectFailure(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await response.json(), { error: 'agreement_unavailable' });
}

test('agreement routes reject unauthenticated and failed authentication without database access', async () => {
  for (const options of [{ user: null }, { authError: { message: 'Expired session' } }]) {
    const h = harness(options);
    await expectFailure(await h.get(), 401);
    await expectFailure(await h.post(), 401);
    assert.equal(h.queries.length, 0);
    assert.equal(h.writes.length, 0);
  }
});

test('unconfirmed accounts can inspect the document but cannot sign it', async () => {
  const h = harness({ user: { ...user, email_confirmed_at: null } });
  const response = await h.get();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).emailConfirmed, false);
  await expectFailure(await h.post(), 403);
  assert.equal(h.writes.length, 0);
});

test('cross-origin, missing-origin and non-JSON submissions are rejected before authentication', async () => {
  for (const [headers, status] of [
    [{ origin: 'https://attacker.invalid' }, 403],
    [{ origin: '' }, 403],
    [{ origin: 'null' }, 403],
    [{ 'content-type': 'text/plain' }, 415],
    [{ 'content-type': 'application/x-www-form-urlencoded' }, 415],
    [{ 'content-type': 'application/json-evil' }, 415],
  ]) {
    const h = harness();
    await expectFailure(await h.post(validInput, { headers }), status);
    assert.equal(h.authCalls, 0);
    assert.equal(h.writes.length, 0);
  }
});

test('malformed JSON, null, arrays and oversized bodies never write acceptance', async () => {
  for (const [raw, status] of [['{', 400], ['null', 400], ['[]', 400], ['"text"', 400], ['true', 400], [' '.repeat(4097), 413]]) {
    const h = harness();
    await expectFailure(await h.post(validInput, { raw }), status);
    assert.equal(h.queries.length, 0);
    assert.equal(h.writes.length, 0);
  }
});

test('a signature requires explicit boolean consent, a valid name and a supported locale', async () => {
  const patches = [
    { consent: false }, { consent: 'true' }, { consent: 1 }, { consent: null },
    { signerName: '' }, { signerName: ' ' }, { signerName: 'A' },
    { signerName: 'A'.repeat(121) }, { signerName: 'First\nLast' }, { signerName: 'Name\u007f' },
    { signerName: 123 }, { locale: 'sq' }, { locale: '' }, { locale: null },
  ];
  for (const patch of patches) {
    const h = harness();
    await expectFailure(await h.post({ ...validInput, ...patch }), 422);
    assert.equal(h.queries.length, 0);
    assert.equal(h.writes.length, 0);
  }
});

test('stale or absent agreement versions require a fresh review before any write', async () => {
  for (const version of ['previous-version', '', null, undefined]) {
    const h = harness();
    await expectFailure(await h.post({ ...validInput, version }), 409);
    assert.equal(h.queries.length, 0);
    assert.equal(h.writes.length, 0);
  }
});

test('GET loads only the signed-in owner and current localized document with no-store', async () => {
  const h = harness();
  const response = await h.get('?user_id=someone-else&version=old', { cookie: 'brickwise-locale=de' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const data = await response.json();
  assert.equal(data.document.locale, 'de');
  assert.equal(data.document.version, manifest.version);
  assert.equal(data.acceptance, null);
  assert.equal(data.emailConfirmed, true);
  assert.deepEqual(h.queries.find(q => q.table === 'client_agreement_acceptances').filters,
    [['user_id', user.id], ['version', manifest.version]]);
  assert.deepEqual(h.queries.find(q => q.table === 'client_agreement_versions').filters,
    [['version', manifest.version], ['locale', 'de'], ['active', true]]);
  assert.equal(h.writes.length, 0);
});

test('acceptance uses server identity and document metadata, ignoring forged client values', async () => {
  const h = harness();
  const response = await h.post({ ...validInput, signerName: '  Fixture Customer  ', locale: 'DE-de',
    user_id: 'someone-else', email: 'attacker@example.invalid', hash: 'forged',
    document_sha256: 'forged', consent_text: 'Forged consent', status: 'approved',
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(h.writes, [{ name: 'accept_client_agreement', args: {
    p_version: manifest.version, p_locale: 'de', p_signer_name: 'Fixture Customer', p_consent: true,
  } }]);
  const data = await response.json();
  assert.equal(data.acceptance.user_id, user.id);
  assert.equal(data.acceptance.email, user.email);
  assert.equal(data.acceptance.status, 'pending');
  assert.equal(data.acceptance.document_sha256, manifest.documents.find(d => d.locale === 'de').sha256);
  assert.equal(data.acceptance.consent_text, data.document.consentText);
  for (const query of h.queries.filter(q => q.table === 'client_agreement_acceptances')) {
    assert.ok(query.filters.some(([key, value]) => key === 'user_id' && value === user.id));
  }
});

test('duplicate or unavailable acceptance RPC errors cannot report success', async () => {
  for (const options of [
    { rpcError: { code: '23505', message: 'Duplicate operation' } },
    { rpcError: { code: 'P0001', message: 'Acceptance unavailable' } },
    { rpcThrows: true },
  ]) {
    const h = harness(options);
    await expectFailure(await h.post(), 503);
    assert.equal(h.writes.length, 1);
    assert.equal(h.queries.filter(q => q.table === 'client_agreement_acceptances').length, 1);
  }
});

test('retry returns the existing accepted record without replacing its identity or signature', async () => {
  const h = harness();
  const first = await (await h.post()).json();
  const second = await (await h.post({ ...validInput, signerName: 'Different name' })).json();
  assert.deepEqual(second.acceptance, first.acceptance);
  assert.equal(second.acceptance.signer_name, validInput.signerName);
});

test('missing storage configuration or unavailable database fails closed without a write', async () => {
  for (const options of [{ clientError: true }, { storageError: true }, { missingDocument: true }]) {
    const h = harness(options);
    await expectFailure(await h.get(), 503);
    await expectFailure(await h.post(), 503);
    assert.equal(h.writes.length, 0);
  }
});

test('changed document hash, path, consent or draft status cannot be accepted', async () => {
  for (const documentPatch of [
    { document_sha256: 'different-hash' }, { document_path: '/documents/other.pdf' },
    { consent_text: 'Different consent' }, { is_draft: false },
  ]) {
    const h = harness({ documentPatch });
    await expectFailure(await h.get(), 503);
    await expectFailure(await h.post(), 503);
    assert.equal(h.writes.length, 0);
  }
});

const receiptId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const receiptRow = {
  id: receiptId, user_id: user.id, signer_name: 'Fixture Customer', email: user.email,
  version: 'historic-v1', locale: 'en', document_path: '/documents/agreements/historic-v1/en.pdf',
  document_sha256: 'historic-pdf-hash', consent_text: 'Original consent at the time of signature.',
  is_draft: true, accepted_at: '2026-09-01T10:15:00+02:00', status: 'approved',
  reviewed_by: 'trusted-admin', reviewed_at: '2026-09-02T14:00:00Z', review_note: 'Document reviewed.',
};
const receiptCopy = compile('app/lib/agreement-copy.ts');

function receiptHarness(options = {}) {
  const queries = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: options.user === undefined ? user : options.user }, error: options.authError || null }) },
    from(table) {
      const query = { table, filters: [] };
      queries.push(query);
      return {
        select(columns) { query.columns = columns; return this; },
        eq(column, value) { query.filters.push([column, value]); return this; },
        maybeSingle: async () => ({ data: options.row === undefined ? receiptRow : options.row, error: options.error || null }),
      };
    },
  };
  const { GET } = compile('app/api/client-agreements/[id]/receipt/route.ts', {
    '@/lib/supabase/server': { createClient: async () => {
      if (options.clientError) throw new Error('Unavailable');
      return client;
    } },
    '@/app/lib/client-agreements': agreements,
    '@/app/lib/agreement-copy': receiptCopy,
    '@/app/lib/i18n': i18n,
  });
  return { queries, get: (id = receiptId) => GET(new Request(`${origin}/api/client-agreements/${id}/receipt?user_id=forged`), { params: Promise.resolve({ id }) }) };
}

async function expectReceiptFailure(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(await response.text(), '');
}

test('receipt requires authenticated access and a valid record ID before querying', async () => {
  for (const options of [{ user: null }, { authError: { message: 'Expired session' } }]) {
    const h = receiptHarness(options);
    await expectReceiptFailure(await h.get(), 401);
    assert.equal(h.queries.length, 0);
  }
  for (const id of ['not-an-id', '../../admin', `${receiptId}?user=other`]) {
    const h = receiptHarness();
    await expectReceiptFailure(await h.get(id), 404);
    assert.equal(h.queries.length, 0);
  }
});

test('receipt respects an absent RLS-filtered row and database failures without leaking content', async () => {
  const hidden = receiptHarness({ row: null });
  await expectReceiptFailure(await hidden.get(), 404);
  assert.deepEqual(hidden.queries[0].filters, [['id', receiptId]]);
  await expectReceiptFailure(await receiptHarness({ error: { message: 'Database detail must not leak' } }).get(), 503);
  await expectReceiptFailure(await receiptHarness({ clientError: true }).get(), 503);
});

test('receipt preserves original acceptance document, consent, hash and timestamps', async () => {
  const h = receiptHarness();
  const response = await h.get();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.match(response.headers.get('content-disposition'), /inline; filename="brickwise-acceptance-/);
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const html = await response.text();
  for (const expected of [receiptRow.consent_text, receiptRow.document_sha256, receiptRow.document_path,
    'historic-v1 (EN)', '2026-09-01T08:15:00.000Z', '2026-09-02T14:00:00.000Z']) {
    assert.ok(html.includes(expected), expected);
  }
  assert.equal(html.includes(manifest.version), false);
  assert.equal(h.queries.length, 1);
  assert.equal(h.queries[0].table, 'client_agreement_acceptances');
});

test('receipt escapes customer names, email, consent, reviewer notes and version metadata', async () => {
  const hostile = '<img src=x onerror="alert(1)"> & \'quoted\'';
  const row = { ...receiptRow, signer_name: hostile, email: hostile, consent_text: hostile,
    review_note: hostile, version: hostile, document_sha256: hostile };
  const response = await receiptHarness({ row }).get();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.equal(html.includes('<img'), false);
  assert.equal(html.includes(hostile), false);
  assert.equal((html.match(/&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; &#39;quoted&#39;/g) || []).length, 6);
});

test('receipt rejects external, injected and traversal document links', async () => {
  for (const document_path of ['javascript:alert(1)', 'https://attacker.invalid/contract.pdf',
    '/documents/agreements/../en.pdf', '/documents/agreements/v1/en.pdf" onmouseover="alert(1)',
    '/documents/agreements/v1/en.pdf?redirect=https://attacker.invalid', '/documents/agreements/v1/sq.pdf']) {
    await expectReceiptFailure(await receiptHarness({ row: { ...receiptRow, document_path } }).get(), 503);
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function compile(path, modules = {}) {
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    assert.ok(name in modules, name);
    return modules[name];
  }, loaded, loaded.exports);
  return loaded.exports;
}
const adminModule = compile('app/lib/admin.ts');
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const admin = { id: 'trusted-admin', app_metadata: { role: 'admin' } };

function harness(options = {}) {
  const writes = [], invalidations = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: options.user === undefined ? admin : options.user }, error: options.authError || null }) },
    rpc: async (name, args) => {
      writes.push({ name, args });
      if (options.rpcThrows) throw new Error('Network unavailable');
      return { error: options.rpcError || null };
    },
  };
  const { reviewAgreement } = compile('app/admin/agreements/actions.ts', {
    'next/cache': { revalidatePath: (...args) => invalidations.push(args) },
    '@/lib/supabase/server': { createClient: async () => client },
    '@/app/lib/admin': adminModule,
  });
  return { writes, invalidations, review: values => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ id, decision: 'approved', note: 'Checked document', ...values })) form.set(key, value);
    return reviewAgreement({ result: '' }, form);
  } };
}

test('agreement review requires trusted app metadata, never client-controlled admin claims', async () => {
  for (const options of [{ user: null }, { user: { id: 'client', user_metadata: { role: 'admin' } } },
    { user: { id: 'client', app_metadata: { role: 'client' } } }, { authError: { message: 'Expired' } }]) {
    const h = harness(options);
    assert.deepEqual(await h.review({}), { result: 'error' });
    assert.equal(h.writes.length, 0);
    assert.equal(h.invalidations.length, 0);
  }
});

test('agreement review validates record, explicit decision and explanatory note', async () => {
  for (const input of [{ id: 'invalid' }, { decision: 'pending' }, { decision: '' },
    { note: '' }, { note: 'ab' }, { note: ' '.repeat(10) }, { note: 'x'.repeat(1001) }]) {
    const h = harness();
    assert.deepEqual(await h.review(input), { result: 'error' });
    assert.equal(h.writes.length, 0);
  }
});

test('valid approval and rejection use the authenticated RPC and refresh relevant views', async () => {
  for (const decision of ['approved', 'rejected']) {
    const h = harness();
    assert.deepEqual(await h.review({ decision, note: '  Checked document  ', reviewed_by: 'forged-admin' }), { result: 'saved' });
    assert.deepEqual(h.writes, [{ name: 'review_client_agreement', args: { p_id: id, p_decision: decision, p_note: 'Checked document' } }]);
    assert.deepEqual(h.invalidations, [['/admin/agreements'], ['/admin'], ['/dashboard', 'layout']]);
  }
});

test('review RPC errors cannot report saved or invalidate views as if a review succeeded', async () => {
  for (const options of [{ rpcError: { message: 'Audit failure' } }, { rpcThrows: true }]) {
    const h = harness(options);
    assert.deepEqual(await h.review({}), { result: 'error' });
    assert.equal(h.writes.length, 1);
    assert.equal(h.invalidations.length, 0);
  }
});

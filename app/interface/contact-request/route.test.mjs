import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const compiled = ts.transpileModule(readFileSync(new URL("./route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Execute the real handler while replacing authentication and database boundaries.
function harness({ user = null, insertError = null } = {}) {
  const writes = [];
  const calls = [];
  const client = {
    auth: {
      getUser: async () => {
        calls.push("getUser");
        return { data: { user }, error: null };
      },
    },
    from(table) {
      assert.equal(table, "property_requests");
      return {
        insert: async (payload) => {
          calls.push("insert");
          writes.push(structuredClone(payload));
          return { error: insertError };
        },
      };
    },
  };
  const dependencies = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/supabase/server": {
      createClient: async () => {
        calls.push("createClient");
        return client;
      },
    },
    "@/app/lib/i18n": { getRequestLocale: () => "en" },
    "@/app/lib/translate": { createTranslator: () => (text) => text },
  };
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => {
      assert.ok(dependencies[name], `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    loadedModule,
    loadedModule.exports,
  );
  return { post: loadedModule.exports.POST, writes, calls };
}

function request(overrides = {}) {
  return new Request("https://test.invalid/interface/contact-request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Test Customer",
      email: "client@example.com",
      message: "Please contact me about this property.",
      ...overrides,
    }),
  });
}

test("anonymous contact requests cannot forge an owner or a completed status", async () => {
  const app = harness();
  const response = await app.post(request({ user_id: "another-customer", status: "completed" }));

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { success: true });
  assert.deepEqual(app.calls, ["createClient", "getUser", "insert"]);
  assert.equal(app.writes.length, 1);
  assert.equal(app.writes[0].user_id, null);
  assert.equal(app.writes[0].status, "new");
});

test("authenticated requests always belong to the verified user and start as new", async () => {
  for (const suppliedOwner of ["another-customer", null]) {
    const app = harness({ user: { id: "verified-customer", email: "client@example.com" } });
    const response = await app.post(request({ user_id: suppliedOwner, status: "closed" }));

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { success: true });
    assert.deepEqual(app.calls, ["createClient", "getUser", "insert"]);
    assert.equal(app.writes.length, 1);
    assert.equal(app.writes[0].user_id, "verified-customer");
    assert.equal(app.writes[0].status, "new");
  }
});

test("invalid JSON is rejected before authentication or database access", async () => {
  const app = harness();
  const response = await app.post(new Request("https://test.invalid/interface/contact-request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{invalid",
  }));

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid JSON request.");
  assert.deepEqual(app.calls, []);
  assert.deepEqual(app.writes, []);
});

test("missing required fields are rejected without authentication or writes", async () => {
  for (const invalid of [{ name: " " }, { email: " " }, { message: " " }]) {
    const app = harness();
    const response = await app.post(request(invalid));

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "Name, email, and message are required.");
    assert.deepEqual(app.calls, []);
    assert.deepEqual(app.writes, []);
  }
});

test("oversized requests are rejected without authentication or writes", async () => {
  for (const invalid of [{ name: "n".repeat(121) }, { email: "e".repeat(255) }, { message: "m".repeat(2001) }]) {
    const app = harness();
    const response = await app.post(request(invalid));

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "The request is too long.");
    assert.deepEqual(app.calls, []);
    assert.deepEqual(app.writes, []);
  }
});

test("both honeypots return success without authentication or writes", async () => {
  for (const field of ["company", "website"]) {
    const app = harness({ user: { id: "verified-customer" } });
    const response = await app.post(request({ [field]: "spam" }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
    assert.deepEqual(app.calls, []);
    assert.deepEqual(app.writes, []);
  }
});

test("an insert failure returns 500 without exposing database details", async () => {
  const app = harness({
    user: { id: "verified-customer" },
    insertError: { message: "internal policy details" },
  });
  const response = await app.post(request({ user_id: "another-customer", status: "completed" }));

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Your request could not be saved. Please try again." });
  assert.deepEqual(app.calls, ["createClient", "getUser", "insert"]);
  assert.equal(app.writes.length, 1);
  assert.equal(app.writes[0].user_id, "verified-customer");
  assert.equal(app.writes[0].status, "new");
});

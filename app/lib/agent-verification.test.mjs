import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function compile(path, modules = {}) {
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "process", code)((name) => {
    if (name in modules) return modules[name];
    if (name === "node:crypto") return require("node:crypto");
    throw new Error(`Unexpected dependency: ${name}`);
  }, loaded, loaded.exports, process);
  return loaded.exports;
}

const verification = compile("app/lib/agent-verification.ts");

test("agent codes, emails and phone numbers are normalised before any lookup", () => {
  for (const [input, expected] of [["BW-ABC234", "BW-ABC234"], ["bw abc234", "BW-ABC234"], ["BWABC234", "BW-ABC234"], [" bw-xyz789 ", "BW-XYZ789"]]) assert.equal(verification.normalizeAgentCode(input), expected, input);
  // Codes never contain the easily confused characters I, O, 0 and 1.
  for (const input of ["BW-ABC10O", "BW-ABCDE", "XX-ABC234", "BW-ABC2345", ""]) assert.equal(verification.normalizeAgentCode(input), null, input);
  assert.equal(verification.normalizeAgentEmail(" Anna.Agent@Brickwise-Immo.de "), "anna.agent@brickwise-immo.de");
  assert.equal(verification.normalizeAgentEmail("not-an-email"), null);
  for (const [input, expected] of [["+49 1521 228-9889", "+4915212289889"], ["0049 (1521) 2289889", "+4915212289889"], ["+355 69 123 4567", "+355691234567"]]) assert.equal(verification.normalizeAgentPhone(input), expected, input);
  for (const input of ["01521 2289889", "+0 1234567", "+49 12", "+49 1521 2289889 ext 5"]) assert.equal(verification.normalizeAgentPhone(input), null, input);
  assert.deepEqual(verification.normalizeLookup("phone", "0049 1521 2289889"), { kind: "phone", value: "+4915212289889" });
  assert.equal(verification.normalizeLookup("name", "Anna"), null);
  assert.equal(verification.normalizeLookup("code", 42), null);
});

function verifyRoute(rpcResult) {
  const calls = [];
  const route = compile("app/api/agents/verify/route.ts", {
    "@/lib/supabase/service": { createServiceClient: () => ({ rpc: async (name, args) => { calls.push([name, args]); return rpcResult; } }) },
    "@/app/lib/agent-verification": verification,
  });
  return { route, calls };
}
const lookup = (body, origin = "https://www.brickwise-immo.de", ip = "203.0.113.9") => new Request("https://www.brickwise-immo.de/api/agents/verify", { method: "POST", headers: { origin, "content-type": "application/json", "x-forwarded-for": `${ip}, 10.0.0.1` }, body: JSON.stringify(body) });
const row = (patch) => ({ data: [{ is_found: true, is_active: true, agent_code: "BW-ABC234", agent_name: "Anna Agent", agent_title: "Investment advisor", agent_languages: ["de", "en"], agent_email: "anna@brickwise-immo.de", agent_phone: "+4915212289889", ...patch }], error: null });

test("the public agent check answers verified, inactive or not found and never reveals more than needed", async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  assert.equal((await verifyRoute(row()).route.POST(lookup({ kind: "code", value: "BW-ABC234" }, "https://evil.example"))).status, 403);
  const invalid = verifyRoute(row());
  assert.equal((await invalid.route.POST(lookup({ kind: "code", value: "nope" }))).status, 400);
  assert.equal(invalid.calls.length, 0, "malformed input never reaches the database");

  const verified = verifyRoute(row());
  const response = await verified.route.POST(lookup({ kind: "code", value: "bw abc234" }));
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { result: "verified", agent: { code: "BW-ABC234", name: "Anna Agent", title: "Investment advisor", languages: ["de", "en"], email: "anna@brickwise-immo.de", phone: "+4915212289889" } });
  const [name, args] = verified.calls[0];
  assert.equal(name, "lookup_agent");
  assert.equal(args.p_value, "BW-ABC234");
  assert.ok(Number.isInteger(args.p_bucket) && args.p_bucket >= 0 && args.p_bucket < 4096, "the rate limit uses a bucket, not the address");
  assert.equal(JSON.stringify(args).includes("203.0.113.9"), false, "the raw IP address is never stored");

  const inactive = await verifyRoute(row({ is_active: false, agent_title: null, agent_email: null, agent_phone: null })).route.POST(lookup({ kind: "email", value: "old@brickwise-immo.de" }));
  assert.deepEqual(await inactive.json(), { result: "inactive", agent: { name: "Anna Agent" } });
  const missing = await verifyRoute({ data: [{ is_found: false, is_active: false }], error: null }).route.POST(lookup({ kind: "phone", value: "+44 7700 900123" }));
  assert.deepEqual(await missing.json(), { result: "notFound" });
  const limited = await verifyRoute({ data: null, error: { message: "LOOKUP_RATE_LIMIT" } }).route.POST(lookup({ kind: "code", value: "BW-ABC234" }));
  assert.equal(limited.status, 429);
});

function adminHarness(options = {}) {
  const calls = [];
  const actions = compile("app/admin/agents/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "admin" } }, error: null }) },
      rpc: async (name, args) => { calls.push([name, args]); return { data: options.rpcError ? null : [{ saved_id: "id", saved_code: "BW-K7M4QZ" }], error: options.rpcError || null }; },
    }) },
    "@/app/lib/admin-session": { hasAdminSession: async () => options.session !== false },
    "@/app/lib/agent-verification": verification,
  });
  return { calls, actions };
}
const form = (values) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) for (const item of [].concat(value)) data.append(key, item); return data; };
const agent = { first_name: "Anna", last_name: "Agent", email: "Anna@Brickwise-Immo.de", whatsapp: "+49 1521 2289889", title: "", languages: ["de", "en", "xx"], active: "on" };

test("agents need first name, last name, email and WhatsApp; the code comes from the database", async () => {
  const ok = adminHarness();
  assert.deepEqual(await ok.actions.saveAgent({ result: "" }, form(agent)), { result: "saved", code: "BW-K7M4QZ" });
  assert.deepEqual(ok.calls, [["save_agent_profile", { p_id: null, p_first_name: "Anna", p_last_name: "Agent", p_email: "anna@brickwise-immo.de", p_whatsapp: "+4915212289889", p_title: null, p_languages: ["de", "en"], p_active: true }]]);
  for (const [patch, result] of [[{ email: "" }, "contact"], [{ whatsapp: "" }, "contact"], [{ email: "bad" }, "contact"], [{ whatsapp: "01521" }, "contact"], [{ first_name: "" }, "error"], [{ last_name: "" }, "error"], [{ title: "X" }, "error"], [{ id: "x" }, "error"]]) {
    const h = adminHarness();
    assert.deepEqual(await h.actions.saveAgent({ result: "" }, form({ ...agent, ...patch })), { result }, JSON.stringify(patch));
    assert.equal(h.calls.length, 0);
  }
  assert.deepEqual(await adminHarness({ rpcError: { code: "23505", message: "duplicate key value" } }).actions.saveAgent({ result: "" }, form(agent)), { result: "duplicate" });
  assert.deepEqual(await adminHarness({ session: false }).actions.saveAgent({ result: "" }, form(agent)), { result: "error" });
  const inactive = adminHarness();
  await inactive.actions.saveAgent({ result: "" }, form({ ...agent, title: "Senior consultant", active: [] }));
  assert.equal(inactive.calls[0][1].p_active, false);
  assert.equal(inactive.calls[0][1].p_title, "Senior consultant");

  const assign = adminHarness();
  const clientId = "66666666-6666-4666-8666-666666666666", agentId = "77777777-7777-4777-8777-777777777777";
  assert.deepEqual(await assign.actions.assignAgent({ result: "" }, form({ user_id: clientId, agent_id: agentId })), { result: "saved" });
  assert.deepEqual(assign.calls[0], ["assign_client_agent", { p_user_id: clientId, p_agent_id: agentId }]);
  const unassign = adminHarness();
  await unassign.actions.assignAgent({ result: "" }, form({ user_id: clientId, agent_id: "" }));
  assert.equal(unassign.calls[0][1].p_agent_id, null, "an empty choice removes the assignment");
  assert.deepEqual(await adminHarness().actions.assignAgent({ result: "" }, form({ user_id: "x", agent_id: agentId })), { result: "error" });
});

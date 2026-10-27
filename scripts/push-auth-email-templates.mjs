// Pushes the three multilingual auth email templates from SUPABASE_EMAIL_OTP_TEMPLATE.md
// to the Supabase project. Only these six auth settings are changed; the previous values
// are saved to project-backups/ first.
// Usage: node scripts/push-auth-email-templates.mjs [check|apply]
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

process.loadEnvFile(".env");
const mode = process.argv[2] || "check";
assert.ok(["check", "apply"].includes(mode), "mode must be check or apply");
assert.ok(process.env.SUPABASE_ACCESS_TOKEN, "SUPABASE_ACCESS_TOKEN missing in .env");
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

const doc = readFileSync("SUPABASE_EMAIL_OTP_TEMPLATE.md", "utf8");
function section(title) {
  const start = doc.indexOf(`## ${title}`);
  assert.ok(start >= 0, `section ${title} missing`);
  const rest = doc.slice(start);
  const subject = rest.match(/Subject:\s*```text\n([\s\S]*?)\n```/)?.[1];
  const html = rest.match(/HTML:\s*```html\n([\s\S]*?)\n```/)?.[1];
  assert.ok(subject && html, `subject or HTML missing in ${title}`);
  return { subject, html };
}
const confirmation = section("1. Confirm signup");
const magic = section("2. Magic Link");
const recovery = section("3. Reset password");
assert.ok(confirmation.html.includes("{{ .ConfirmationURL }}") && !confirmation.html.includes("{{ .Token }}"));
assert.ok(magic.html.includes("{{ .Token }}") && !magic.html.includes("{{ .ConfirmationURL }}"));
assert.ok(recovery.html.includes('href="{{ .ConfirmationURL }}"'));

const update = {
  mailer_subjects_confirmation: confirmation.subject,
  mailer_templates_confirmation_content: confirmation.html,
  mailer_subjects_magic_link: magic.subject,
  mailer_templates_magic_link_content: magic.html,
  mailer_subjects_recovery: recovery.subject,
  mailer_templates_recovery_content: recovery.html,
};

const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" };
const current = await fetch(api, { headers, signal: AbortSignal.timeout(30000) });
if (!current.ok) throw Error(`Reading auth config failed: ${current.status} ${await current.text()}`);
const currentConfig = await current.json();
const before = Object.fromEntries(Object.keys(update).map((key) => [key, currentConfig[key]]));

if (mode === "check") {
  for (const [key, value] of Object.entries(update)) console.log(`${key}: ${before[key] === value ? "unchanged" : "will change"}`);
} else {
  mkdirSync("project-backups/auth-email-templates", { recursive: true });
  writeFileSync(`project-backups/auth-email-templates/before-${Date.now()}.json`, JSON.stringify(before, null, 2));
  const response = await fetch(api, { method: "PATCH", headers, body: JSON.stringify(update), signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error(`Update failed: ${response.status} ${await response.text()}`);
  const after = await response.json();
  for (const [key, value] of Object.entries(update)) assert.equal(after[key], value, `${key} was not saved`);
  console.log("Applied: confirmation, magic link and recovery templates (5 languages).");
}

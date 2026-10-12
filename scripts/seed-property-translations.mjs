import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line)).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1).trim().replace(/^['\"]|['\"]$/g, "")];
  }),
);

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const translations = JSON.parse(readFileSync("PROPERTY_TRANSLATIONS_SEED.json", "utf8"));
const { error } = await client.from("property_translations").upsert(translations, { onConflict: "property_slug,locale" });
if (error) throw error;
const { data, error: readError } = await client.from("property_translations").select("property_slug,locale");
if (readError) throw readError;
const counts = new Map();
for (const row of data) counts.set(row.property_slug, (counts.get(row.property_slug) || 0) + 1);
for (const [slug, count] of [...counts.entries()].sort()) console.log(`${slug}=${count}`);
if (translations.some((item) => counts.get(item.property_slug) !== 5)) process.exit(2);

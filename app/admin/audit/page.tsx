import { getAdminText } from "@/app/lib/admin-copy";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { localeHtmlLang } from "@/app/lib/i18n";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/app/lib/admin";
import { createClient } from "@/lib/supabase/server";

type AuditLog = {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  status: "success" | "failure";
  details: Record<string, unknown>;
  created_at: string;
};

export default async function AdminAuditPage() {
  const locale = await getCurrentLocale();
  const t = getAdminText(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminUser(user)) redirect("/admin");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return <AuditMessage message={t("Audit service configuration is missing.")} />;

  const admin = createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin
    .from("admin_audit_logs")
    .select("id,actor_email,action,target_type,target_id,status,details,created_at")
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) return <AuditMessage message={t("Audit logs could not be loaded.")} />;
  const logs = (data || []) as AuditLog[];

  return (
    <main className="min-h-screen bg-[#060914] px-5 py-10 text-white sm:px-10">
      <div className="mx-auto max-w-7xl">
        <p className="font-bold uppercase tracking-[0.16em] text-[#45aee8]">{t("Security")}</p>
        <h1 className="mt-3 text-4xl font-bold sm:text-6xl">{t("Admin audit logs")}</h1>
        <p className="mt-4 max-w-3xl text-white/70">{t("Immutable history of sensitive actions performed through the administrator panel. The newest 250 events are shown.")}</p>

        <div className="mt-10 overflow-x-auto rounded-2xl border border-white/15 bg-white text-[#17233f]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#eef3f7] text-xs uppercase tracking-wide text-[#667085]"><tr><th className="px-5 py-4">{t("Time")}</th><th className="px-5 py-4">{t("Administrator")}</th><th className="px-5 py-4">{t("Action")}</th><th className="px-5 py-4">{t("Target")}</th><th className="px-5 py-4">{t("Status")}</th><th className="px-5 py-4">{t("Details")}</th></tr></thead>
            <tbody className="divide-y divide-slate-200">
              {logs.map((log) => <tr key={log.id} className="align-top"><td className="whitespace-nowrap px-5 py-4">{new Intl.DateTimeFormat(localeHtmlLang[locale], { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" }).format(new Date(log.created_at))} UTC</td><td className="px-5 py-4">{log.actor_email || t("Unknown")}</td><td className="px-5 py-4 font-semibold">{log.action}</td><td className="px-5 py-4"><span className="block">{log.target_type}</span><span className="text-xs text-slate-500">{log.target_id || "—"}</span></td><td className="px-5 py-4"><span className={log.status === "success" ? "text-emerald-700" : "text-red-700"}>{t(log.status === "success" ? "Success" : "Failure")}</span></td><td className="max-w-sm px-5 py-4 font-mono text-xs text-slate-600">{JSON.stringify(log.details)}</td></tr>)}
              {logs.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">{t("No administrative actions have been recorded yet.")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function AuditMessage({ message }: { message: string }) {
  return <main className="min-h-screen bg-[#060914] p-10 text-white"><div className="mx-auto max-w-4xl rounded-2xl border border-red-400/30 bg-red-500/10 p-6">{message}</div></main>;
}

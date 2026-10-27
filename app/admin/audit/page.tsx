import { getAdminText } from "@/app/lib/admin-copy";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { localeHtmlLang } from "@/app/lib/i18n";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { hasAdminSession } from "@/app/lib/admin-session";
import { createClient } from "@/lib/supabase/server";
import { AdminAlert, AdminCard, AdminEmpty, AdminPageHeader, StatusBadge } from "../ui";

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
  if (!(await hasAdminSession(supabase, user))) redirect("/admin");

  const header = <AdminPageHeader eyebrow={t("Security")} title={t("Admin audit logs")} description={t("Immutable history of sensitive actions performed through the administrator panel. The newest 250 events are shown.")} />;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return <main className="admin-workspace">{header}<AdminAlert tone="danger">{t("Audit service configuration is missing.")}</AdminAlert></main>;

  const admin = createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin
    .from("admin_audit_logs")
    .select("id,actor_email,action,target_type,target_id,status,details,created_at")
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) return <main className="admin-workspace">{header}<AdminAlert tone="danger">{t("Audit logs could not be loaded.")}</AdminAlert></main>;
  const logs = (data || []) as AuditLog[];
  const time = new Intl.DateTimeFormat(localeHtmlLang[locale], { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" });

  return (
    <main className="admin-workspace">
      {header}
      <AdminCard title={t("Admin audit logs")} flush>
        {logs.length === 0 ? <AdminEmpty>{t("No administrative actions have been recorded yet.")}</AdminEmpty> : <table className="admin-table admin-table-stack">
          <thead><tr><th scope="col">{t("Time")}</th><th scope="col">{t("Administrator")}</th><th scope="col">{t("Action")}</th><th scope="col">{t("Target")}</th><th scope="col">{t("Status")}</th><th scope="col">{t("Details")}</th></tr></thead>
          <tbody>
            {logs.map((log) => <tr key={log.id}>
              <td data-label={t("Time")} className="whitespace-nowrap">{time.format(new Date(log.created_at))} UTC</td>
              <td data-label={t("Administrator")} className="break-all">{log.actor_email || t("Unknown")}</td>
              <td data-label={t("Action")}><code className="admin-code-inline">{log.action}</code></td>
              <td data-label={t("Target")}><p>{log.target_type}</p><p className="admin-cell-sub break-all">{log.target_id || "—"}</p></td>
              <td data-label={t("Status")}><StatusBadge status={log.status} label={t(log.status === "success" ? "Success" : "Failure")} /></td>
              <td data-label={t("Details")} className="max-w-sm break-all font-mono text-[11.5px] text-[var(--admin-muted)]">{JSON.stringify(log.details)}</td>
            </tr>)}
          </tbody>
        </table>}
      </AdminCard>
    </main>
  );
}

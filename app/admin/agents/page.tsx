import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/app/lib/admin";
import { hasAdminSession } from "@/app/lib/admin-session";
import { getCurrentLocale } from "@/app/lib/server-locale";
import { getAdminText } from "@/app/lib/admin-copy";
import { agentCopy } from "@/app/lib/agent-copy";
import { AdminAlert, AdminCard, AdminEmpty, AdminPageHeader, AdminStat, StatusBadge } from "../ui";
import { getClientDirectory } from "../client-directory";
import { AgentForm, AssignForm } from "./AgentForms";

type Agent = { id: string; code: string; first_name: string | null; last_name: string | null; full_name: string; title: string; email: string | null; phone: string | null; languages: string[]; active: boolean; created_at: string };

export default async function AdminAgentsPage() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!isAdminUser(user)) redirect("/dashboard");
  if (!(await hasAdminSession(client, user))) redirect("/admin/security");
  const locale = await getCurrentLocale(), t = getAdminText(locale), languageNames = agentCopy[locale].languageNames, defaultTitle = agentCopy[locale].defaultTitle;
  const titleOf = (agent: Agent) => agent.title === "Brickwise agent" ? defaultTitle : agent.title;
  const [{ data, error }, { data: assignmentRows }, directory] = await Promise.all([
    client.from("agents").select("id,code,first_name,last_name,full_name,title,email,phone,languages,active,created_at").order("active", { ascending: false }).order("full_name"),
    client.from("client_agents").select("user_id,agent_id"),
    getClientDirectory(),
  ]);
  const agents = (data || []) as Agent[];
  // A row with no agent is a removed assignment.
  const assignments = ((assignmentRows || []) as { user_id: string; agent_id: string | null }[]).filter((row): row is { user_id: string; agent_id: string } => Boolean(row.agent_id));
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const assignedTo = (agentId: string) => assignments.filter((row) => row.agent_id === agentId).map((row) => directory.get(row.user_id)).filter(Boolean);
  const clients = [...directory.entries()].filter(([, person]) => !person.admin).sort(([, a], [, b]) => a.name.localeCompare(b.name))
    .map(([id, person]) => {
      const current = agentById.get(assignments.find((row) => row.user_id === id)?.agent_id || "");
      return { id, label: `${person.name} — ${person.email}${current ? ` (${current.code})` : ""}` };
    });
  const labels = {
    firstName: t("First name"), lastName: t("Last name"), email: t("Official email"), whatsapp: t("WhatsApp number"), phoneHint: t("International format, e.g. +49 1521 2289889."),
    title: t("Role (optional)"), uniqueCode: t("Unique code"), codeHint: t("The unique code is created automatically when you save."),
    languages: t("Languages"), active: t("Active agent (shown as verified)"), save: t("Save"), saved: t("Agent saved."), error: t("The agent could not be saved."),
    contact: t("Enter a valid email and a WhatsApp number in international format."), duplicate: t("This email or WhatsApp number already belongs to another agent."),
    client: t("Customer"), agent: t("Agent"), none: t("No agent"), assign: t("Assign"),
  };
  return <main className="admin-workspace">
    <AdminPageHeader eyebrow={t("Settings")} title={t("Official agents")} description={t("Clients can check every agent by code, email or WhatsApp number on the public page Verify an agent. Deactivate an agent as soon as they leave, so the check warns clients.")}
      actions={<Link href="/verify-agent" target="_blank" className="admin-btn admin-btn-secondary">{t("Open public check")}<ArrowUpRight size={15} aria-hidden="true" /></Link>} />
    {error && <AdminAlert tone="danger">{t("Agents could not be loaded.")}</AdminAlert>}
    <section className="admin-stats" aria-label={t("Key figures")}>
      <AdminStat label={t("Active agents")} value={agents.filter((agent) => agent.active).length} />
      <AdminStat label={t("Clients with an agent")} value={assignments.length} />
    </section>
    <AdminCard title={t("Add agent")}><AgentForm labels={labels} languageNames={languageNames} defaultTitle={defaultTitle} /></AdminCard>
    <AdminCard title={t("Official agents")} flush>
      {!agents.length ? <AdminEmpty>{t("No agents yet. Add your first agent above.")}</AdminEmpty> : <div className="admin-list">
        <div className="admin-list-head" aria-hidden="true"><span>{t("Agent code")}</span><span>{t("Agent")}</span><span>{t("Contact")}</span><span>{t("Languages")}</span><span className="admin-num">{t("Assigned clients")}</span><span>{t("Status")}</span><span /></div>
        {agents.map((agent) => {
          const people = assignedTo(agent.id);
          return <details key={agent.id} className="admin-list-row">
            <summary>
              <span className="admin-list-date font-mono text-[12.5px] font-semibold">{agent.code}</span>
              <span className="admin-list-primary"><span className="admin-cell-main">{agent.full_name}</span><span className="admin-cell-sub">{titleOf(agent)}</span></span>
              <span className="admin-list-secondary">{agent.email && <span className="admin-cell-sub break-all">{agent.email}</span>}{agent.phone && <span className="admin-cell-sub">WhatsApp {agent.phone}</span>}</span>
              <span className="admin-list-meta text-[12.5px]">{agent.languages.map((language) => languageNames[language as keyof typeof languageNames] || language).join(", ") || "—"}</span>
              <span className="admin-list-amount">{people.length}</span>
              <span className="admin-list-status"><StatusBadge status={agent.active ? "active" : "closed"} label={t(agent.active ? "Active" : "Inactive")} /></span>
              <ChevronDown size={16} aria-hidden="true" className="admin-disclosure-icon" />
            </summary>
            <div className="admin-list-detail">
              {people.length > 0 && <p className="admin-note"><span className="block font-semibold">{t("Assigned clients")}</span>{people.map((person) => `${person!.name} (${person!.email})`).join(", ")}</p>}
              <p className="admin-form-heading">{t("Edit")}</p>
              <AgentForm agent={agent} labels={labels} languageNames={languageNames} defaultTitle={defaultTitle} />
            </div>
          </details>;
        })}
      </div>}
    </AdminCard>
    <AdminCard title={t("Assign an agent to a client")} description={t("The client sees this agent in their panel under Account.")}>
      <AssignForm clients={clients} agents={agents.filter((agent) => agent.active).map((agent) => ({ id: agent.id, label: `${agent.full_name} — ${agent.code}` }))} labels={{ ...labels, saved: t("Assignment saved.") }} />
    </AdminCard>
  </main>;
}

import { cookies } from "next/headers";
import { riskTranslations } from "./translations";
import ClientPortalSidebar from "@/app/components/ClientPortalSidebar";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isAdminUser } from "@/app/lib/admin";
import { localeCookieName, normalizeLocale } from "../lib/i18n";

const content = {
  ...riskTranslations,
  en: { title: "Risk Notes", intro: "Real estate can offer income potential, but every project carries economic, legal, market, and liquidity risk.", adviceTitle: "No investment advice", advice: "Website content is informational only. Review each project carefully and consult qualified financial, legal, and tax professionals before making decisions.", risks: ["Capital loss risk: real estate investments can result in partial or total loss of capital.", "Rent and vacancy risk: expected rental income may be lower than modelled or may stop temporarily.", "Cost risk: repairs, management, financing, insurance, taxes, and unexpected costs can reduce returns.", "Market risk: property values can decline due to interest rates, local demand, affordability, or economic conditions.", "Liquidity risk: participation interests may not be freely saleable or redeemable at any time.", "Regulatory and tax risk: legal, national, regional, or municipal changes can affect project economics."] },
  it: { title: "Avvertenze sui rischi", intro: "Gli immobili possono offrire un potenziale di reddito, ma ogni progetto comporta rischi economici, legali, di mercato e di liquidità.", adviceTitle: "Nessuna consulenza in materia di investimenti", advice: "I contenuti del sito hanno esclusivamente carattere informativo. Valuta attentamente ogni progetto e consulta professionisti qualificati in materia finanziaria, legale e fiscale prima di prendere decisioni.", risks: ["Rischio di perdita del capitale: gli investimenti immobiliari possono comportare la perdita parziale o totale del capitale.", "Rischio di locazione e sfitto: il reddito da locazione previsto può essere inferiore alle stime o interrompersi temporaneamente.", "Rischio dei costi: riparazioni, gestione, finanziamento, assicurazioni, imposte e spese impreviste possono ridurre i rendimenti.", "Rischio di mercato: il valore degli immobili può diminuire a causa dei tassi di interesse, della domanda locale, dell'accessibilità economica o delle condizioni economiche.", "Rischio di liquidità: le partecipazioni potrebbero non essere liberamente vendibili o rimborsabili in qualsiasi momento.", "Rischio normativo e fiscale: cambiamenti legali, nazionali, regionali o comunali possono incidere sull'economia del progetto."] },
};

export default async function RiskPage() {
  const cookieStore = await cookies();
  const signedIn = await getCurrentUser();
  // Administrators see the public risk page, not the client portal.
  const user = isAdminUser(signedIn) ? null : signedIn;
  const locale = normalizeLocale(cookieStore.get(localeCookieName)?.value) || "en";
  const text = content[locale];
  const email = user?.email || "";
  const fullName = String(user?.user_metadata?.full_name || email.split("@")[0] || "Client");

  return <>
    {user && <ClientPortalSidebar active="risk" email={email} fullName={fullName} locale={locale} />}
    <main className={`bg-canvas text-ink ${user ? "min-h-screen pt-16 lg:ml-[282px] lg:pt-0" : ""}`}><section className="mx-auto max-w-5xl px-6 pb-24 pt-36"><p className="text-lg font-bold text-emerald-700">BRICKWISE</p><h1 className="font-display mt-4 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">{text.title}</h1><p className="mt-6 max-w-3xl text-xl leading-relaxed text-slate-600">{text.intro}</p><div className="mt-14 grid gap-5">{text.risks.map((risk) => <div key={risk} className="rounded-2xl bg-white p-6 shadow-sm"><p className="text-lg leading-relaxed text-slate-700">{risk}</p></div>)}</div><div className="mt-12 rounded-2xl bg-ink p-8 text-white"><h2 className="text-3xl font-bold">{text.adviceTitle}</h2><p className="mt-4 text-lg leading-relaxed text-white/75">{text.advice}</p></div></section></main>
  </>;
}

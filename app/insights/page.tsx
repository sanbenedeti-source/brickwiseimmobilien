import Link from "next/link";
import { insightsTranslations } from "./translations";
import { cookies } from "next/headers";
import { BarChart3, CircleHelp, House, Layers3, Search } from "lucide-react";
import InsightsSearch from "./InsightsSearch";
import { localeCookieName, normalizeLocale } from "../lib/i18n";

const content = {
  ...insightsTranslations,
  en: { eyebrow: "Brickwise knowledge centre", title: "Everything you need to navigate Brickwise", intro: "Simple, actionable explanations for fractional real estate and the investor workflow.", search: "Search for answers", categories: [
    { icon: House, title: "What is Brickwise?", text: "Learn how the platform, property information, and agent workflow fit together.", href: "/about", meta: "Platform guide" },
    { icon: BarChart3, title: "Rental income and returns", text: "Understand gross yield, operating costs, modelled income, and appreciation assumptions.", href: "/insights/what-to-review-before-comparing-rental-yield", meta: "Income guide" },
    { icon: Layers3, title: "Getting started", text: "Review fractional shares, compare properties, create an account, and request the next steps.", href: "/real-estate-investing", meta: "Investor guide" },
    { icon: CircleHelp, title: "Frequently asked questions", text: "Quick answers about requests, funding review, risk, liquidity, and account access.", href: "/risk", meta: "Essential answers" },
  ]},
  it: { eyebrow: "Centro conoscenze Brickwise", title: "Tutto ciò che serve per orientarsi in Brickwise", intro: "Spiegazioni semplici e concrete sugli immobili frazionati e sul percorso dell'investitore.", search: "Cerca una risposta", categories: [
    { icon: House, title: "Che cos'è Brickwise?", text: "Scopri come si integrano piattaforma, informazioni sugli immobili e assistenza del team.", href: "/about", meta: "Guida alla piattaforma" },
    { icon: BarChart3, title: "Reddito da locazione e rendimenti", text: "Comprendi rendimento lordo, costi operativi, reddito stimato e ipotesi di rivalutazione.", href: "/insights/what-to-review-before-comparing-rental-yield", meta: "Guida al reddito" },
    { icon: Layers3, title: "Come iniziare", text: "Esamina le quote frazionate, confronta gli immobili, crea un account e richiedi i passaggi successivi.", href: "/real-estate-investing", meta: "Guida per investitori" },
    { icon: CircleHelp, title: "Domande frequenti", text: "Risposte rapide su richieste, verifica dei fondi, rischi, liquidità e accesso al conto.", href: "/risk", meta: "Risposte essenziali" },
  ]},
};

export default async function LearnPage() {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(localeCookieName)?.value) || "en";
  const text = content[locale];
  return <main className="min-h-screen bg-canvas text-ink">
    <section className="bg-ink px-6 pb-20 pt-28 text-white"><div className="mx-auto max-w-4xl text-center"><p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-light">{text.eyebrow}</p><h1 className="mt-4 text-4xl font-bold sm:text-5xl">{text.title}</h1><p className="mt-4 text-lg text-white/85">{text.intro}</p><label className="mx-auto mt-8 flex max-w-2xl items-center rounded-lg bg-white px-5 text-ink shadow-lg focus-within:ring-4 focus-within:ring-brand-light"><InsightsSearch placeholder={text.search} /><Search size={20} className="text-muted" aria-hidden="true" /></label></div></section>
    <section className="mx-auto -mt-10 max-w-4xl px-6 pb-24"><div className="grid gap-4">{text.categories.map(({ icon: Icon, title, text: description, href, meta }) => <Link key={title} href={href} data-insight-card className="group grid gap-4 rounded-xl border border-line bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:grid-cols-[56px_1fr_auto] sm:items-center"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon size={28} /></span><span><strong className="block text-xl">{title}</strong><span className="mt-1 block text-sm leading-6 text-muted">{description}</span></span><span className="text-sm font-bold text-brand">{meta} →</span></Link>)}</div></section>
  </main>;
}

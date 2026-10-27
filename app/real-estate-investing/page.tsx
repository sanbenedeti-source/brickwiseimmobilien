import Link from "next/link";
import { cookies } from "next/headers";
import { localeCookieName, normalizeLocale } from "../lib/i18n";
import { guideCopy } from "../lib/guide-copy";
import { formatMinimumInvestment } from "../lib/investment-policy";

export default async function RealEstateInvestingPage() {
  const locale = normalizeLocale((await cookies()).get(localeCookieName)?.value) || "en";
  const text = guideCopy[locale];
  const steps = text.items.map(([title, value]) => ({ title, text: value.replace("{minimum}", formatMinimumInvestment(locale)) }));
  return (
    <main className="bg-canvas text-ink">
      <section className="bg-ink px-6 pb-20 pt-36 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-lg font-bold text-emerald-300">BRICKWISE</p>
          <h1 className="font-display mt-4 max-w-5xl text-4xl font-bold leading-tight sm:text-5xl md:text-7xl">
            {text.title}
          </h1>
          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-white/75">
            {text.intro}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded-2xl bg-white p-7 shadow-sm">
              <p className="text-4xl font-bold text-emerald-700">{index + 1}</p>
              <h2 className="mt-5 text-2xl font-bold">{step.title}</h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                {step.text}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <h2 className="text-4xl font-bold">{text.reviewTitle}</h2>
            <div className="mt-8 grid gap-4 text-lg text-slate-700">
              {text.review.map((item) => <p key={item}>{item}</p>)}
            </div>
          </div>

          <div className="rounded-2xl bg-ink p-8 text-white">
            <h2 className="text-4xl font-bold">{text.start}</h2>
            <p className="mt-5 text-lg leading-relaxed text-white/75">
              {text.startText}
            </p>
            <Link
              href="/properties"
              className="mt-8 inline-flex rounded-lg bg-white px-8 py-4 text-lg font-bold text-ink"
            >
              {text.properties}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

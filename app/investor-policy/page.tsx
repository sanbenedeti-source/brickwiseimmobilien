import { cookies } from "next/headers";
import { localeCookieName, normalizeLocale } from "../lib/i18n";
import { guideCopy } from "../lib/guide-copy";

export default async function InvestorPolicy() {
  const locale = normalizeLocale((await cookies()).get(localeCookieName)?.value) || "en";
  const text = guideCopy[locale];
  const guidelines = text.guidelines.map(([title, text]) => ({ title, text }));
  return (
    <main className="bg-[#f4f4f2] text-[#0f172a]">
      <section className="mx-auto max-w-5xl px-6 pb-24 pt-36">
        <p className="text-lg font-bold text-emerald-700">BRICKWISE</p>
        <h1 className="font-display mt-4 text-6xl font-bold leading-tight">
          {text.policyTitle}
        </h1>
        <p className="mt-6 max-w-3xl text-xl leading-relaxed text-slate-600">
          {text.policyIntro}
        </p>

        <div className="mt-14 space-y-6">
          {guidelines.map((item, index) => (
            <section key={item.title} className="rounded-2xl bg-white p-7 shadow-sm">
              <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">
                {text.policy} {index + 1}
              </p>
              <h2 className="mt-3 text-3xl font-bold">{item.title}</h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                {item.text}
              </p>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}

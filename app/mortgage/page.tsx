"use client";
import { useLocale } from "../components/LocaleProvider";
import { createTranslator, translateContent } from "../lib/translate";

import Link from "next/link";
import { useMemo, useState } from "react";

type ProductKey = "5-year-fixed" | "3-year-fixed" | "variable";

const baseloanProducts: Record<
  ProductKey,
  {
    label: string;
    headlineRate: number;
    apr: number;
    term: string;
    providers: Array<{
      name: string;
      rate: number;
      apr: number;
      fee: number;
      note: string;
    }>;
  }
> = {
  "5-year-fixed": {
    label: "5-year fixed",
    headlineRate: 5.14,
    apr: 5.32,
    term: "Most searched",
    providers: [
      { name: "Maple Trust", rate: 5.09, apr: 5.28, fee: 995, note: "Full documentation review" },
      { name: "Northline Lending", rate: 5.19, apr: 5.36, fee: 795, note: "Owner-occupied scenarios" },
      { name: "Harbour Mortgage", rate: 5.24, apr: 5.41, fee: 0, note: "No lender fee estimate" },
    ],
  },
  "3-year-fixed": {
    label: "3-year fixed",
    headlineRate: 5.39,
    apr: 5.58,
    term: "Shorter commitment",
    providers: [
      { name: "Cedar Bank", rate: 5.29, apr: 5.51, fee: 850, note: "Rate hold available" },
      { name: "Metro Home Finance", rate: 5.44, apr: 5.64, fee: 650, note: "Good renewal option" },
      { name: "TrueNorth Capital", rate: 5.49, apr: 5.7, fee: 500, note: "Flexible prepayment terms" },
    ],
  },
  variable: {
    label: "Variable",
    headlineRate: 5.65,
    apr: 5.76,
    term: "Adjusts with prime",
    providers: [
      { name: "Lakeview Lending", rate: 5.55, apr: 5.69, fee: 500, note: "Prime-linked rate" },
      { name: "Dominion Mortgage", rate: 5.7, apr: 5.82, fee: 0, note: "Convertible option" },
      { name: "Summit Credit", rate: 5.78, apr: 5.91, fee: 350, note: "Lower setup estimate" },
    ],
  },
};

const basetools = [
  {
    title: "Mortgage calculator",
    text: "Estimate monthly payment, taxes, insurance, closing cash, and amortization.",
    href: "/mortgage-calculator",
  },
  {
    title: "Affordability calculator",
    text: "Model the home budget that may fit income, debt, rate, and down payment.",
    href: "#affordability",
  },
  {
    title: "Refinance calculator",
    text: "Compare current and new payment estimates for a mortgage renewal or refinance.",
    href: "#refinance",
  },
  {
    title: "Pre-approval checklist",
    text: "Prepare the documents lenders commonly ask for before reviewing a file.",
    href: "#pre-approval",
  },
];

const baseloanOptions = [
  ["5-year fixed", "Stable payment", "5% to 20%+", "650+", "Popular Canadian fixed-rate benchmark"],
  ["3-year fixed", "Shorter rate lock", "5% to 20%+", "650+", "Useful when rates may move before renewal"],
  ["Variable", "Rate can adjust", "5% to 20%+", "680+", "Payment or interest cost may change with prime"],
  ["Insured mortgage", "Lower down payment", "5% to 19.99%", "Varies", "Mortgage default insurance usually applies"],
  ["Refinance", "Equity review", "Often 20%+ equity", "Varies", "Qualification depends on lender and property"],
];

const baseterms = [
  ["Amortization", "The full schedule used to repay principal and interest over time, often 25 or 30 years."],
  ["APR", "A cost measure that combines interest rate and some borrowing costs into one annual percentage."],
  ["Debt service ratio", "A lender measure comparing housing payments and other debts against gross income."],
  ["Loan-to-value", "The loan amount compared with the property value. A lower LTV usually means more equity."],
  ["Mortgage insurance", "Default insurance may apply when the down payment is below 20% in Canada."],
  ["Pre-approval", "A lender review of income, debt, credit, and down payment before final property approval."],
];

const cityLinks = [
  "Toronto",
  "Vancouver",
  "Calgary",
  "Ottawa",
  "Montreal",
  "Edmonton",
  "Halifax",
  "Winnipeg",
  "Victoria",
  "Mississauga",
  "Brampton",
  "Hamilton",
];

function monthlyPayment(loanAmount: number, rate: number, years: number) {
  const monthlyRate = rate / 100 / 12;
  const months = years * 12;

  if (loanAmount <= 0) return 0;
  if (monthlyRate === 0) return loanAmount / months;

  return (
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
  );
}

function Input({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-600">{label}</span>
      <span className="flex overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-[#0F172A]">
        {prefix && (
          <span className="flex w-11 items-center justify-center bg-slate-50 font-bold text-slate-500">
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 px-4 py-3 text-lg font-bold text-[#0F172A] outline-none"
        />
        {suffix && (
          <span className="flex w-12 items-center justify-center bg-slate-50 font-bold text-slate-500">
            {suffix}
          </span>
        )}
      </span>
    </label>
  );
}

function SectionTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="max-w-4xl">
      <p className="text-sm font-bold uppercase tracking-wide text-red-700">{eyebrow}</p>
      <h2 className="mt-2 text-[2rem] font-bold leading-tight sm:text-4xl md:text-5xl">{title}</h2>
      {text && <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">{text}</p>}
    </div>
  );
}

export default function MortgageHubPage() {
  const locale = useLocale();
  const euro = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const t = createTranslator(locale);
  const loanProducts = translateContent(baseloanProducts, locale);
  const tools = translateContent(basetools, locale);
  const loanOptions = translateContent(baseloanOptions, locale);
  const terms = translateContent(baseterms, locale);
  const [activeProduct, setActiveProduct] = useState<ProductKey>("5-year-fixed");
  const [purchasePrice, setPurchasePrice] = useState(725000);
  const [downPayment, setDownPayment] = useState(145000);
  const [income, setIncome] = useState(120000);
  const [debts, setDebts] = useState(650);
  const [refiBalance, setRefiBalance] = useState(520000);
  const [currentRate, setCurrentRate] = useState(6.1);
  const [newRate, setNewRate] = useState(5.15);

  const selectedProduct = loanProducts[activeProduct];

  const ratePayment = useMemo(() => {
    return monthlyPayment(
      Math.max(0, purchasePrice - downPayment),
      selectedProduct.headlineRate,
      30
    );
  }, [downPayment, purchasePrice, selectedProduct.headlineRate]);

  const affordability = useMemo(() => {
    const monthlyIncome = income / 12;
    const maxMortgageBudget = Math.max(0, monthlyIncome * 0.32 - debts);
    const monthlyRate = selectedProduct.headlineRate / 100 / 12;
    const estimatedLoan = maxMortgageBudget
      ? (maxMortgageBudget * (1 - Math.pow(1 + monthlyRate, -30 * 12))) /
        (monthlyRate || 1)
      : 0;

    return estimatedLoan + downPayment;
  }, [debts, downPayment, income, selectedProduct.headlineRate]);

  const refinance = useMemo(() => {
    const currentPayment = monthlyPayment(refiBalance, currentRate, 30);
    const newPayment = monthlyPayment(refiBalance, newRate, 30);

    return {
      currentPayment,
      newPayment,
      monthlySavings: Math.max(0, currentPayment - newPayment),
    };
  }, [currentRate, newRate, refiBalance]);

  return (
    <main className="min-h-screen bg-[#f5f5f2] px-4 pb-16 pt-28 text-[#0F172A] sm:px-6 md:pt-36">
      <section className="mx-auto max-w-7xl">
        <section className="grid gap-8 lg:grid-cols-[1fr_0.75fr] lg:items-stretch">
          <div className="rounded-[22px] bg-[#0F172A] p-5 text-white sm:p-6 md:rounded-[32px] md:p-10">
            <p className="text-lg font-bold text-red-300">{t("Mortgage center")}</p>
            <h1 className="font-display mt-3 text-[2.55rem] font-bold leading-[0.98] sm:mt-4 sm:text-5xl md:text-7xl">
              {t("Get mortgage-ready before you choose a property")}</h1>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/75 md:text-xl">
              {t("Explore payment estimates, Canadian rate scenarios, refinance savings, affordability, and document readiness in one focused mortgage hub.")}</p>
            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              <Link
                href="/mortgage-calculator"
                className="rounded-xl bg-white px-6 py-3 text-center text-base font-bold text-[#0F172A]"
              >
                {t("Calculate payment")}</Link>
              <a
                href="#pre-approval"
                className="rounded-xl border border-white/30 px-6 py-3 text-center text-base font-bold text-white"
              >
                {t("Prepare pre-approval")}</a>
            </div>
          </div>

          <aside className="rounded-[22px] bg-white p-5 shadow-sm sm:p-6 md:rounded-[32px] md:p-8">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
              {t("Featured estimate")}</p>
            <p className="mt-3 text-4xl font-bold leading-none sm:text-5xl">
              {euro.format(Math.round(ratePayment))}
            </p>
            <p className="mt-2 text-lg font-bold text-slate-500">{t("per month")}</p>
            <div className="mt-7 grid gap-4">
              <Input label={t("Purchase price")} prefix="€" value={purchasePrice} step={5000} onChange={setPurchasePrice} />
              <Input label={t("Down payment")} prefix="€" value={downPayment} step={5000} onChange={setDownPayment} />
            </div>
            <div className="mt-6 rounded-2xl bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-4">
                <span className="font-bold text-slate-500">{selectedProduct.label}</span>
                <span className="text-2xl font-bold sm:text-3xl">{selectedProduct.headlineRate.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {t("Estimate excludes tax, insurance, and lender-specific conditions.")}</p>
            </div>
          </aside>
        </section>

        <section className="mt-8">
          <SectionTitle
            eyebrow={t("Tools")}
            title={t("Mortgage tools")}
            text={t("Explore payment, affordability, and refinancing estimates to prepare your mortgage decisions.")}
          />
          <div className="mt-6 grid gap-5 md:grid-cols-4">
            {tools.map((tool) => (
              <Link
                key={tool.title}
                href={tool.href}
                className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <h3 className="text-2xl font-bold">{tool.title}</h3>
                <p className="mt-3 leading-relaxed text-slate-600">{tool.text}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-[22px] bg-white p-5 shadow-sm md:rounded-[32px] md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <SectionTitle
              eyebrow={t("Rates")}
              title={t("Illustrative rate: {product}").replace("{product}", selectedProduct.label)}
              text={t("Compare illustrative Canadian mortgage scenarios. These sample rates are planning assumptions, not current lender offers.")}
            />
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-bold text-slate-500">{t("Rate / APR")}</p>
              <p className="mt-1 text-3xl font-bold sm:text-4xl">
                {selectedProduct.headlineRate.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% / {selectedProduct.apr.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
            {(Object.keys(loanProducts) as ProductKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveProduct(key)}
                className={`rounded-xl px-5 py-3 text-base font-bold ${
                  activeProduct === key
                    ? "bg-[#0F172A] text-white"
                    : "bg-slate-100 text-[#0F172A]"
                }`}
              >
                {loanProducts[key].label}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {selectedProduct.providers.map((provider) => (
              <div key={provider.name} className="rounded-2xl border border-slate-200 p-5">
                <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                  {selectedProduct.term}
                </p>
                <h3 className="mt-2 text-2xl font-bold">{provider.name}</h3>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500">{t("APR")}</p>
                    <p className="mt-1 text-xl font-bold">{provider.apr.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500">{t("Rate")}</p>
                    <p className="mt-1 text-xl font-bold">{provider.rate.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500">{t("Fees")}</p>
                    <p className="mt-1 text-xl font-bold">{euro.format(provider.fee)}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-500">{provider.note}</p>
                <a
                  href="#pre-approval"
                  className="mt-5 block rounded-xl bg-[#0F172A] px-4 py-3 text-center font-bold text-white"
                >
                  {t("Prepare quote")}</a>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-2">
          <section id="affordability" className="rounded-[22px] bg-white p-5 shadow-sm md:rounded-[32px] md:p-7">
            <SectionTitle eyebrow={t("Affordability")} title={t("How much could fit?")} />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Input label={t("Annual income")} prefix="€" value={income} step={1000} onChange={setIncome} />
              <Input label={t("Monthly debt")} prefix="€" value={debts} step={50} onChange={setDebts} />
              <Input label={t("Down payment")} prefix="€" value={downPayment} step={1000} onChange={setDownPayment} />
              <div className="rounded-2xl bg-[#0F172A] p-5 text-white">
                <p className="text-sm font-bold text-white/60">{t("Estimated budget")}</p>
                <p className="mt-2 text-3xl font-bold sm:text-4xl">{euro.format(Math.round(affordability))}</p>
              </div>
            </div>
          </section>

          <section id="refinance" className="rounded-[22px] bg-white p-5 shadow-sm md:rounded-[32px] md:p-7">
            <SectionTitle eyebrow={t("Refinance")} title={t("Could a lower rate help?")} />
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Input label={t("Balance")} prefix="€" value={refiBalance} step={5000} onChange={setRefiBalance} />
              <Input label={t("Current rate")} suffix="%" value={currentRate} step={0.05} onChange={setCurrentRate} />
              <Input label={t("New rate")} suffix="%" value={newRate} step={0.05} onChange={setNewRate} />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm font-bold text-slate-500">{t("Current")}</p>
                <p className="mt-2 text-2xl font-bold">{euro.format(Math.round(refinance.currentPayment))}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm font-bold text-slate-500">{t("New")}</p>
                <p className="mt-2 text-2xl font-bold">{euro.format(Math.round(refinance.newPayment))}</p>
              </div>
              <div className="rounded-2xl bg-[#0F172A] p-5 text-white">
                <p className="text-sm font-bold text-white/60">{t("Savings")}</p>
                <p className="mt-2 text-2xl font-bold">{euro.format(Math.round(refinance.monthlySavings))}</p>
              </div>
            </div>
          </section>
        </section>

        <section className="mt-10 rounded-[22px] bg-white p-5 shadow-sm md:rounded-[32px] md:p-8">
          <SectionTitle
            eyebrow={t("Loan options")}
            title={t("Home loan options")}
            text={t("A compact comparison table for common mortgage scenarios in Canada.")}
          />
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 text-sm uppercase tracking-wide text-slate-500">
                  <th className="py-4 pr-4">{t("Loan type")}</th>
                  <th className="py-4 pr-4">{t("Best for")}</th>
                  <th className="py-4 pr-4">{t("Down payment")}</th>
                  <th className="py-4 pr-4">{t("Credit guide")}</th>
                  <th className="py-4 pr-4">{t("Notes")}</th>
                </tr>
              </thead>
              <tbody>
                {loanOptions.map(([type, bestFor, minimum, score, note]) => (
                  <tr key={type} className="border-b border-slate-100">
                    <td className="py-4 pr-4 text-lg font-bold">{type}</td>
                    <td className="py-4 pr-4">{bestFor}</td>
                    <td className="py-4 pr-4">{minimum}</td>
                    <td className="py-4 pr-4">{score}</td>
                    <td className="py-4 pr-4 text-slate-600">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-[0.8fr_1fr]" id="pre-approval">
          <section className="rounded-[22px] bg-white p-5 shadow-sm md:rounded-[32px] md:p-7">
            <SectionTitle eyebrow={t("Pre-approval")} title={t("Lender readiness checklist")} />
            <div className="mt-6 grid gap-3">
              {[
                t("Government ID and contact details"),
                t("Employment letter or recent pay stubs"),
                t("T4 / tax documents or business income records"),
                t("Down payment proof and source of funds"),
                t("Credit obligations and monthly debt list"),
                t("Property tax, condo fee, and insurance assumptions"),
              ].map((item) => (
                <label key={item} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <input type="checkbox" className="h-5 w-5 accent-[#0F172A]" />
                  <span className="font-bold text-slate-700">{item}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-[22px] bg-white p-5 shadow-sm md:rounded-[32px] md:p-7">
            <SectionTitle eyebrow={t("Common terms")} title={t("Mortgage glossary")} />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {terms.map(([title, text]) => (
                <div key={title} className="rounded-2xl bg-slate-50 p-5">
                  <h3 className="text-2xl font-bold">{title}</h3>
                  <p className="mt-3 leading-relaxed text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-2">
          <section className="rounded-[22px] bg-white p-5 shadow-sm md:rounded-[32px] md:p-7">
            <SectionTitle eyebrow={t("Rates by city")} title={t("Canadian mortgage markets")} />
            <div className="mt-6 flex flex-wrap gap-2 sm:gap-3">
              {cityLinks.map((city) => (
                <span key={city} className="rounded-full bg-slate-100 px-4 py-2 font-bold text-slate-700">
                  {city} {t("mortgage rates")}</span>
              ))}
            </div>
          </section>

          <section className="rounded-[22px] bg-white p-5 shadow-sm md:rounded-[32px] md:p-7">
            <SectionTitle eyebrow={t("Rates by type")} title={t("Mortgage products")} />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[t("5-year fixed"), t("3-year fixed"), t("1-year fixed"), t("Variable"), t("Refinance"), t("Insured mortgage")].map((item) => (
                <span key={item} className="rounded-xl bg-slate-50 px-4 py-3 font-bold text-slate-700">
                  {item}
                </span>
              ))}
            </div>
          </section>
        </section>

        <p className="mt-8 max-w-5xl text-sm leading-relaxed text-slate-500">
          {t("Rates and payments on this page are illustrative planning estimates. They are not lender quotes, mortgage offers, pre-approvals, or financial advice. Confirm available rates and conditions directly with a qualified lender.")}</p>
      </section>
    </main>
  );
}

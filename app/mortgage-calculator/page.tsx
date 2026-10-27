"use client";
import { useLocale } from "../components/LocaleProvider";
import { createTranslator } from "../lib/translate";

import { useMemo, useState } from "react";

type LoanTerm = 15 | 20 | 25 | 30;

function monthlyPrincipalAndInterest(loanAmount: number, annualRate: number, termYears: number) {
  const months = termYears * 12;
  const monthlyRate = annualRate / 100 / 12;

  if (loanAmount <= 0) return 0;
  if (monthlyRate === 0) return loanAmount / months;

  return (
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
  );
}

function makeAmortizationRows(loanAmount: number, annualRate: number, termYears: number) {
  const rows: Array<{
    year: number;
    principal: number;
    interest: number;
    balance: number;
  }> = [];
  const monthlyRate = annualRate / 100 / 12;
  const payment = monthlyPrincipalAndInterest(loanAmount, annualRate, termYears);
  let balance = loanAmount;

  for (let year = 1; year <= termYears; year += 1) {
    let principal = 0;
    let interest = 0;

    for (let month = 1; month <= 12; month += 1) {
      const monthlyInterest = balance * monthlyRate;
      const monthlyPrincipal = Math.min(payment - monthlyInterest, balance);
      interest += monthlyInterest;
      principal += monthlyPrincipal;
      balance = Math.max(0, balance - monthlyPrincipal);
    }

    rows.push({ year, principal, interest, balance });
  }

  return rows;
}

function Field({
  label,
  prefix,
  suffix,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  prefix?: string;
  suffix?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-600">{label}</span>
      <span className="flex overflow-hidden rounded-xl border border-line-strong bg-white focus-within:border-ink">
        {prefix && (
          <span className="flex w-12 items-center justify-center bg-slate-50 text-lg font-bold text-slate-500">
            {prefix}
          </span>
        )}
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-0 min-w-0 flex-1 px-4 py-3 text-lg font-bold text-ink outline-none"
        />
        {suffix && (
          <span className="flex w-14 items-center justify-center bg-slate-50 text-sm font-bold text-slate-500">
            {suffix}
          </span>
        )}
      </span>
    </label>
  );
}

function BreakdownRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const euro = new Intl.NumberFormat(useLocale(), { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`h-3 w-3 shrink-0 rounded-full ${color}`} />
        <span className="font-bold text-slate-700">{label}</span>
      </div>
      <span className="text-lg font-bold text-ink">{euro.format(Math.round(value))}</span>
    </div>
  );
}

export default function MortgageCalculatorPage() {
  const locale = useLocale();
  const euro = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const t = createTranslator(locale);
  const [homePrice, setHomePrice] = useState(725000);
  const [downPayment, setDownPayment] = useState(145000);
  const [interestRate, setInterestRate] = useState(5.35);
  const [loanTerm, setLoanTerm] = useState<LoanTerm>(30);
  const [propertyTaxRate, setPropertyTaxRate] = useState(0.72);
  const [homeInsurance, setHomeInsurance] = useState(180);
  const [hoaFees, setHoaFees] = useState(0);
  const [closingCostRate, setClosingCostRate] = useState(3);

  const result = useMemo(() => {
    const safeHomePrice = Math.max(0, homePrice);
    const safeDownPayment = Math.min(Math.max(0, downPayment), safeHomePrice);
    const downPaymentPercent = safeHomePrice ? (safeDownPayment / safeHomePrice) * 100 : 0;
    const loanAmount = Math.max(0, safeHomePrice - safeDownPayment);
    const principalInterest = monthlyPrincipalAndInterest(loanAmount, interestRate, loanTerm);
    const monthlyTax = (safeHomePrice * (propertyTaxRate / 100)) / 12;
    const mortgageInsurance = downPaymentPercent < 20 ? loanAmount * 0.0065 / 12 : 0;
    const totalMonthly =
      principalInterest + monthlyTax + homeInsurance + hoaFees + mortgageInsurance;
    const closingCosts = safeHomePrice * (closingCostRate / 100);
    const dueAtClose = safeDownPayment + closingCosts;
    const amortization = makeAmortizationRows(loanAmount, interestRate, loanTerm);
    const totalInterest = amortization.reduce((sum, row) => sum + row.interest, 0);

    return {
      downPaymentPercent,
      loanAmount,
      principalInterest,
      monthlyTax,
      mortgageInsurance,
      totalMonthly,
      closingCosts,
      dueAtClose,
      amortization,
      totalInterest,
    };
  }, [
    closingCostRate,
    downPayment,
    hoaFees,
    homeInsurance,
    homePrice,
    interestRate,
    loanTerm,
    propertyTaxRate,
  ]);

  const segments = [
    { label: t("Principal & interest"), value: result.principalInterest, color: "bg-ink", stroke: "#0F172A" },
    { label: t("Property tax"), value: result.monthlyTax, color: "bg-red-600", stroke: "#DC2626" },
    { label: t("Home insurance"), value: homeInsurance, color: "bg-emerald-600", stroke: "#059669" },
    { label: t("Mortgage insurance"), value: result.mortgageInsurance, color: "bg-amber-500", stroke: "#F59E0B" },
    { label: t("HOA / condo fees"), value: hoaFees, color: "bg-sky-600", stroke: "#0284C7" },
  ];
  const activeSegments = segments.filter((segment) => segment.value > 0);
  let offset = 0;

  return (
    <main className="min-h-screen bg-canvas px-4 pb-16 pt-28 text-ink sm:px-6 md:pt-36">
      <section className="mx-auto max-w-7xl">
        <div className="max-w-4xl">
          <p className="text-lg font-bold text-brand">{t("Mortgage tools")}</p>
          <h1 className="font-display mt-3 text-[2rem] font-bold leading-[1.05] sm:text-5xl md:text-7xl">
            {t("Mortgage calculator")}</h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg md:text-xl">
            {t("Estimate a monthly Canadian home payment, closing cash, and amortization using your own price, down payment, rate, and cost assumptions.")}</p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_0.8fr]">
          <section className="rounded-[22px] bg-white p-5 shadow-sm md:rounded-[32px] md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                  {t("Estimated monthly payment")}</p>
                <p className="mt-2 text-4xl font-bold leading-none sm:text-5xl md:text-7xl">
                  {euro.format(Math.round(result.totalMonthly))}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-5 py-4">
                <p className="text-sm font-bold text-slate-500">{t("Loan amount")}</p>
                <p className="mt-1 text-2xl font-bold">{euro.format(Math.round(result.loanAmount))}</p>
              </div>
            </div>

            <div className="mt-8 grid gap-8 md:grid-cols-[240px_1fr] md:items-center">
              <div className="relative mx-auto h-48 w-48 sm:h-56 sm:w-56">
                <svg viewBox="0 0 120 120" className="-rotate-90">
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="14"
                  />
                  {activeSegments.map((segment) => {
                    const circumference = 2 * Math.PI * 46;
                    const length = result.totalMonthly
                      ? (segment.value / result.totalMonthly) * circumference
                      : 0;
                    const dashOffset = offset;
                    offset += length;

                    return (
                      <circle
                        key={segment.label}
                        cx="60"
                        cy="60"
                        r="46"
                        fill="none"
                        stroke={segment.stroke}
                        strokeDasharray={`${length} ${circumference - length}`}
                        strokeDashoffset={-dashOffset}
                        strokeLinecap="round"
                        strokeWidth="14"
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-sm font-bold text-slate-500">{t("Monthly")}</span>
                  <span className="text-2xl font-bold sm:text-3xl">
                    {euro.format(Math.round(result.totalMonthly))}
                  </span>
                </div>
              </div>

              <div className="grid gap-3">
                {segments.map((segment) => (
                  <BreakdownRow key={segment.label} {...segment} />
                ))}
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-ink p-5 text-white">
                <p className="text-sm font-bold text-white/60">{t("Due at close")}</p>
                <p className="mt-2 text-2xl font-bold sm:text-3xl">{euro.format(Math.round(result.dueAtClose))}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm font-bold text-slate-500">{t("Down payment")}</p>
                <p className="mt-2 text-2xl font-bold sm:text-3xl">{result.downPaymentPercent.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm font-bold text-slate-500">{t("Total interest")}</p>
                <p className="mt-2 text-2xl font-bold sm:text-3xl">{euro.format(Math.round(result.totalInterest))}</p>
              </div>
            </div>
          </section>

          <aside className="rounded-[22px] bg-white p-5 shadow-sm md:rounded-[32px] md:p-8">
            <h2 className="text-2xl font-bold sm:text-3xl">{t("Payment inputs")}</h2>

            <div className="mt-6 grid gap-5">
              <Field label={t("Home price")} prefix="€" value={homePrice} min={0} step={5000} onChange={setHomePrice} />
              <Field label={t("Down payment")} prefix="€" value={downPayment} min={0} step={5000} onChange={setDownPayment} />

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-600">{t("Loan term")}</span>
                <select
                  value={loanTerm}
                  onChange={(event) => setLoanTerm(Number(event.target.value) as LoanTerm)}
                  className="w-full rounded-xl border border-line-strong bg-white px-4 py-3 text-lg font-bold text-ink outline-none focus:border-ink"
                >
                  <option value={15}>{t("15 years fixed")}</option>
                  <option value={20}>{t("20 years fixed")}</option>
                  <option value={25}>{t("25 years fixed")}</option>
                  <option value={30}>{t("30 years fixed")}</option>
                </select>
              </label>

              <Field label={t("Interest rate")} suffix="%" value={interestRate} min={0} max={20} step={0.01} onChange={setInterestRate} />
              <Field label={t("Property tax rate")} suffix="%" value={propertyTaxRate} min={0} max={10} step={0.01} onChange={setPropertyTaxRate} />
              <Field label={t("Monthly home insurance")} prefix="€" value={homeInsurance} min={0} step={10} onChange={setHomeInsurance} />
              <Field label={t("Monthly HOA / condo fees")} prefix="€" value={hoaFees} min={0} step={25} onChange={setHoaFees} />
              <Field label={t("Closing cost estimate")} suffix="%" value={closingCostRate} min={0} max={10} step={0.1} onChange={setClosingCostRate} />
            </div>
          </aside>
        </div>

        <section className="mt-8 rounded-[22px] bg-white p-5 shadow-sm md:rounded-[32px] md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">{t("Amortization snapshot")}</h2>
              <p className="mt-2 text-lg text-slate-600">
                {t("First five years of principal, interest, and remaining balance.")}</p>
            </div>
            <p className="rounded-2xl bg-slate-50 px-5 py-3 text-lg font-bold">
              {loanTerm} {t("year term")}</p>
          </div>

          <div tabIndex={0} className="focus-visible:outline-2 focus-visible:outline-brand mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 text-sm uppercase tracking-wide text-slate-500">
                  <th className="py-4 pr-4">{t("Year")}</th>
                  <th className="py-4 pr-4">{t("Principal paid")}</th>
                  <th className="py-4 pr-4">{t("Interest paid")}</th>
                  <th className="py-4 pr-4">{t("Remaining balance")}</th>
                </tr>
              </thead>
              <tbody>
                {result.amortization.slice(0, 5).map((row) => (
                  <tr key={row.year} className="border-b border-slate-100">
                    <td className="py-4 pr-4 text-lg font-bold">{row.year}</td>
                    <td className="py-4 pr-4">{euro.format(Math.round(row.principal))}</td>
                    <td className="py-4 pr-4">{euro.format(Math.round(row.interest))}</td>
                    <td className="py-4 pr-4">{euro.format(Math.round(row.balance))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">{t("Home price")}</p>
            <p className="mt-3 text-3xl font-bold sm:text-4xl">{euro.format(homePrice)}</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">{t("Down payment")}</p>
            <p className="mt-3 text-3xl font-bold sm:text-4xl">{euro.format(downPayment)}</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">{t("Payments")}</p>
            <p className="mt-3 text-3xl font-bold sm:text-4xl">{number.format(loanTerm * 12)}</p>
          </div>
        </section>

        <p className="mt-8 max-w-5xl text-sm leading-relaxed text-slate-500">
          {t("This calculator is for educational estimates only. It does not include every fee, lender rule, land transfer tax, qualification test, or insurance condition that may apply to a real Canadian mortgage.")}</p>
      </section>
    </main>
  );
}

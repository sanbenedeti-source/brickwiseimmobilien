"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export type CompanyWallet = { asset: string; network: string; address: string };

export default function CompanyWallets({ wallets, copyLabel, copiedLabel }: { wallets: CompanyWallet[]; copyLabel: string; copiedLabel: string }) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  async function copyAddress(address: string) {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    window.setTimeout(() => setCopiedAddress(null), 2000);
  }

  return (
    <div className="mt-8 grid gap-4 lg:grid-cols-2">
      {wallets.map((wallet) => {
        const copied = copiedAddress === wallet.address;
        return (
          <article key={`${wallet.asset}-${wallet.network}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-2xl font-bold">{wallet.asset}</p><p className="mt-1 text-sm font-bold uppercase tracking-wide text-emerald-700">{wallet.network}</p></div>
              <button type="button" onClick={() => copyAddress(wallet.address)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:border-emerald-600 hover:text-emerald-700" aria-label={`${copyLabel}: ${wallet.asset} ${wallet.network}`}>
                {copied ? <Check size={17} /> : <Copy size={17} />}{copied ? copiedLabel : copyLabel}
              </button>
            </div>
            <p className="mt-5 break-all rounded-xl bg-white p-4 font-mono text-sm leading-6 text-slate-800">{wallet.address}</p>
          </article>
        );
      })}
    </div>
  );
}

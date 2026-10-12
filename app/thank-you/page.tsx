import { cookies } from "next/headers";
import { localeCookieName, normalizeLocale } from "../lib/i18n";
import { sharedCopy } from "../lib/shared-copy";
import Link from "next/link";
import GoogleAdsConversion from "@/app/components/GoogleAdsConversion";

export default async function ThankYouPage({ searchParams }: { searchParams: Promise<{ conversion?: string }> }) {
  const params = await searchParams;
  const locale = normalizeLocale((await cookies()).get(localeCookieName)?.value) || "en";
  const text = sharedCopy[locale];
  return (
    <main className="min-h-screen bg-[#f5f5f2] text-[#111111]">
      {params.conversion === "lead" && (
        <>
          <GoogleAdsConversion />
        </>
      )}
      <section className="flex min-h-[80vh] items-center justify-center px-6 py-24">
        <div className="max-w-3xl rounded-[32px] bg-white p-12 text-center shadow-sm">
          <p className="text-lg font-bold text-emerald-600">
            {text.success}</p>

          <h1 className="font-display mt-4 text-5xl font-bold leading-tight">
            {text.thanks}</h1>

          <p className="mt-6 text-xl leading-relaxed text-slate-600">
            {text.followup}</p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/properties"
              className="rounded-2xl bg-[#0F172A] px-8 py-4 text-lg font-bold text-white"
            >
              {text.backProperties}</Link>

            <Link
              href="/"
              className="rounded-2xl border border-[#0F172A] px-8 py-4 text-lg font-bold text-[#0F172A]"
            >
              {text.home}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

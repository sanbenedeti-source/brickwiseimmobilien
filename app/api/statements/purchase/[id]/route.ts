import { createClient } from "@/lib/supabase/server";
import { getRequestLocale, localeHtmlLang } from "@/app/lib/i18n";
import { portalCopy } from "@/app/lib/portal-copy";
import { buildTablePdf } from "@/app/lib/statement-pdf";
import { findProperty } from "@/app/lib/property-registry";
import { getPropertyTranslations } from "@/app/lib/property-localization";

const noStore = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

/** PDF confirmation of one share purchase from the client's own wallet ledger. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) return new Response(null, { status: 404, headers: noStore });
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return new Response(null, { status: 401, headers: noStore });
    const { data: row, error: readError } = await client.from("wallet_transactions")
      .select("id,type,amount,property_slug,shares,created_at").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (readError) return new Response(null, { status: 503, headers: noStore });
    if (!row || row.type !== "purchase" || !row.shares) return new Response(null, { status: 404, headers: noStore });
    const locale = getRequestLocale(request), text = portalCopy[locale], lang = localeHtmlLang[locale];
    const translations = await getPropertyTranslations(locale);
    const property = row.property_slug ? await findProperty(row.property_slug) : undefined;
    const title = translations.get(row.property_slug || "")?.title || property?.title || row.property_slug || "—";
    const amount = Number(row.amount), shares = Number(row.shares);
    const money = (value: number) => value.toLocaleString(lang, { style: "currency", currency: "EUR" });
    const pdf = await buildTablePdf({
      title: text.purchaseConfirmation,
      subtitle: `${String(user.user_metadata?.full_name || user.email)} · ${user.email}`,
      facts: [
        [text.date, new Date(row.created_at).toLocaleString(lang, { dateStyle: "long", timeStyle: "short" })],
        [text.property, title],
        [text.sharesCount, shares.toLocaleString(lang)],
        [text.pricePerShare, money(amount / shares)],
        [text.totalAmount, money(amount)],
        [text.reference, row.id],
      ],
      footer: `Brickwise · ${text.purchaseConfirmation}`,
    });
    return new Response(pdf as BodyInit, { headers: { ...noStore, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="brickwise-purchase-${id.slice(0, 8)}.pdf"`, "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response(null, { status: 503, headers: noStore }); }
}

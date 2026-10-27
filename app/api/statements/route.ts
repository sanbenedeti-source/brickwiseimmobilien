import { createClient } from "@/lib/supabase/server";
import { getRequestLocale, localeHtmlLang } from "@/app/lib/i18n";
import { portalCopy } from "@/app/lib/portal-copy";
import { buildStatement, csvCell, type StatementRange } from "@/app/lib/client-finance";
import { loadLedger } from "@/app/lib/statement-data";
import { buildTablePdf } from "@/app/lib/statement-pdf";
import { getAllProperties } from "@/app/lib/property-registry";
import { getPropertyTranslations } from "@/app/lib/property-localization";

const noStore = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

/** Account statement export (CSV or PDF) for the signed-in client. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format") === "pdf" ? "pdf" : "csv";
    const range = (["30", "90", "year", "all"].includes(url.searchParams.get("range") || "") ? url.searchParams.get("range") : "year") as StatementRange;
    const direction = (["credit", "debit"].includes(url.searchParams.get("dir") || "") ? url.searchParams.get("dir") : "all") as "all" | "credit" | "debit";
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return new Response(null, { status: 401, headers: noStore });
    const ledger = await loadLedger(client, user.id);
    if (!ledger) return new Response(null, { status: 503, headers: noStore });
    const locale = getRequestLocale(request), text = portalCopy[locale], lang = localeHtmlLang[locale];
    const translations = await getPropertyTranslations(locale);
    const titles = new Map((await getAllProperties()).map((property) => [property.slug, translations.get(property.slug)?.title || property.title]));
    const statement = buildStatement(ledger, range, direction);
    const money = (value: number) => value.toLocaleString(lang, { style: "currency", currency: "EUR" });
    const date = (value: string) => new Date(value).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" });
    const describe = (row: (typeof statement.rows)[number]) => `${text.transactionType[row.kind]}${row.shares ? ` · ${row.shares} ${text.shares}` : ""}`;
    const fileDate = new Date().toISOString().slice(0, 10);
    const periodLabel = { "30": text.last30, "90": text.last90, year: text.thisYear, all: text.allTime }[range];

    if (format === "csv") {
      const header = [text.date, text.description, text.property, text.credit, text.debit, text.balance, "ID"].map(csvCell).join(";");
      const lines = statement.rows.map((row) => [
        new Date(row.created_at).toISOString(), describe(row), row.property_slug ? titles.get(row.property_slug) || row.property_slug : "",
        row.direction === "credit" ? row.amount.toFixed(2) : "", row.direction === "debit" ? row.amount.toFixed(2) : "", row.balance.toFixed(2), row.id,
      ].map(csvCell).join(";"));
      return new Response(`﻿${[header, ...lines].join("\r\n")}\r\n`, { headers: { ...noStore, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="brickwise-statement-${fileDate}.csv"` } });
    }

    const name = String(user.user_metadata?.full_name || user.email || "");
    const pdf = await buildTablePdf({
      title: text.statementTitle,
      subtitle: `${name} · ${user.email}`,
      facts: [[text.statementPeriod, periodLabel], [text.openingBalance, money(statement.opening)], [text.closingBalance, money(statement.closing)]],
      table: {
        columns: [{ label: text.date, width: 110 }, { label: text.description, width: 150 }, { label: text.property, width: 140 }, { label: text.credit, width: 70, align: "right" }, { label: text.debit, width: 70, align: "right" }, { label: text.balance, width: 80, align: "right" }],
        rows: statement.rows.map((row) => [date(row.created_at), describe(row), row.property_slug ? titles.get(row.property_slug) || row.property_slug : "—",
          row.direction === "credit" ? money(row.amount) : "", row.direction === "debit" ? money(row.amount) : "", money(row.balance)]),
      },
      footer: `Brickwise · ${text.statementTitle} · ${fileDate}`,
    });
    return new Response(pdf as BodyInit, { headers: { ...noStore, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="brickwise-statement-${fileDate}.pdf"`, "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response(null, { status: 503, headers: noStore }); }
}

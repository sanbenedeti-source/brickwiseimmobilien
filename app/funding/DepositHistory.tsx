import type { Locale } from "../lib/i18n";
import { localeHtmlLang } from "../lib/i18n";
import { getAdminText } from "../lib/admin-copy";
import type { Deposit } from "./deposit-store";
import type { GatewayDeposit } from "./gateway-store";
import { depositText } from "./deposit-copy";

const head = "bg-slate-50 px-5 py-2.5 align-bottom text-[11px] font-semibold uppercase leading-4 tracking-wider text-muted";
const cell = "border-t border-line px-5 py-3.5 align-top";

type Row = { id: string; created_at: string; label: string; detail: string; note: string | null; reference: string; amount: number; credited: string | null; status: string; tone: "success" | "danger" | "neutral" | "pending" };

export default function DepositHistory({deposits,gateway=[],locale,error}:{deposits:Deposit[];gateway?:GatewayDeposit[];locale:Locale;error:boolean}) {
 const d=depositText(locale), t=getAdminText(locale), lang=localeHtmlLang[locale];
 const euro=(value:number|null)=>Number(value||0).toLocaleString(lang,{style:"currency",currency:"EUR"});
 const gatewayStatus: Record<string, [string, Row["tone"]]> = {
  awaiting_payment:[d("awaiting_payment"),"pending"], confirming:[d("confirming"),"pending"], paid:[d("verified"),"success"], review:[d("underReview"),"pending"],
  failed:[d("failed"),"danger"], expired:[d("expired"),"neutral"], canceled:[d("canceled"),"neutral"], refunded:[d("refunded"),"neutral"],
 };
 const rows: Row[] = [
  ...deposits.map((row): Row => ({ id:row.id, created_at:row.created_at, label:row.destination.label,
   detail:row.destination.kind==="crypto"?`${row.destination.crypto_asset} · ${row.destination.crypto_network}`:"EUR", note:row.review_note,
   reference:row.transfer_reference, amount:Number(row.requested_eur),
   credited:row.status==="verified" || row.status==="refunded" ? `${d(row.status==="refunded"?"refunded":"credited")}: ${euro(row.credited_eur)}` : null,
   status:d(row.status), tone:row.status==="verified"?"success":row.status==="rejected"?"danger":"pending" })),
  ...gateway.map((row): Row => {
   const [status, tone] = gatewayStatus[row.status] || [row.status, "neutral"];
   return { id:row.id, created_at:row.created_at, label:d("gatewayDestination"),
    detail:row.pay_currency && row.pay_amount ? `${Number(row.pay_amount).toLocaleString(lang,{maximumFractionDigits:8})} ${row.pay_currency}` : t("Cryptocurrency"), note:null,
    reference:row.provider_order_id ? `CoinGate #${row.provider_order_id}` : "—", amount:Number(row.amount_eur),
    credited:row.status==="paid" ? `${d("credited")}: ${euro(row.amount_eur)}` : null, status, tone };
  }),
 ].sort((a,b)=>b.created_at.localeCompare(a.created_at));
 const toneClass={success:"bg-emerald-50 text-emerald-800",danger:"bg-red-50 text-red-700",neutral:"bg-slate-100 text-slate-600",pending:"bg-amber-50 text-amber-800"};
 return <section className="overflow-hidden rounded-xl border border-line bg-white">
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4"><h2 className="text-base font-semibold">{d("history")}</h2><a href="/funding" className="text-sm font-semibold text-brand hover:underline">{d("refresh")}</a></div>
  {error?<p role="alert" className="px-5 py-6 text-sm text-red-800">{d("loadError")}</p>:!rows.length?<p className="px-5 py-8 text-center text-sm text-muted">{d("empty")}</p>:<div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
   <thead><tr><th scope="col" className={head}>{t("Date")}</th><th scope="col" className={head}>{t("Destination")}</th><th scope="col" className={head}>{t("Reference")}</th><th scope="col" className={`${head} text-right`}>{t("Amount")}</th><th scope="col" className={`${head} text-right`}>{t("Status")}</th></tr></thead>
   <tbody>{rows.map(row=><tr key={row.id}>
    <td className={`${cell} whitespace-nowrap text-muted`}>{new Date(row.created_at).toLocaleString(lang,{dateStyle:"medium",timeStyle:"short"})}</td>
    <td className={cell}><p className="font-semibold">{row.label}</p><p className="text-xs text-muted">{row.detail}</p>{row.note && <p className="mt-1 max-w-sm whitespace-pre-line break-words text-xs leading-5 text-muted">{row.note}</p>}</td>
    <td className={`${cell} max-w-[14rem] break-all font-mono text-xs`}>{row.reference}</td>
    <td className={`${cell} whitespace-nowrap text-right tabular-nums`}><p className="font-semibold">{euro(row.amount)}</p>{row.credited && <p className="text-xs text-emerald-700">{row.credited}</p>}</td>
    <td className={`${cell} text-right`}><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClass[row.tone]}`}>{row.status}</span></td>
   </tr>)}</tbody>
  </table></div>}
 </section>;
}

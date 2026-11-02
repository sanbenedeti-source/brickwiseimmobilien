"use client";

import { useActionState, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Scale } from "lucide-react";
import { addClientShares, adjustClientWallet, buyBackClientShares, type InvestmentState } from "./actions";

export type InvestmentLabels = Record<
  | "property" | "shares" | "pricePerShare" | "total" | "payment" | "fromWallet" | "outsideWallet" | "note" | "notePlaceholder"
  | "confirm" | "addSubmit" | "buyBackSubmit" | "adjustSubmit" | "direction" | "addToWallet" | "subtractFromWallet" | "amount"
  | "saved" | "error" | "invalid" | "funds" | "sharesError" | "next" | "available" | "held", string>;

type PropertyOption = { slug: string; title: string; sharePrice: number; available: number };
type HoldingOption = { slug: string; title: string; shares: number; sharePrice: number };

const money = (value: number, lang: string) => value.toLocaleString(lang, { style: "currency", currency: "EUR" });

function Result({ state, labels }: { state: InvestmentState; labels: InvestmentLabels }) {
  if (!state.result || state.result === "saved") return null;
  const text = state.result === "funds" ? labels.funds : state.result === "shares" ? labels.sharesError : state.result === "invalid" ? labels.invalid : labels.error;
  return <p role="alert" className="admin-alert admin-alert-danger !mb-0">{text}</p>;
}

function Saved({ labels }: { labels: InvestmentLabels }) {
  return <div className="admin-form">
    <p role="status" className="admin-alert admin-alert-success !mb-0">{labels.saved}</p>
    {/* A reload gives the next operation a fresh request key from the server. */}
    <div><button type="button" className="admin-btn admin-btn-secondary" onClick={() => window.location.reload()}>{labels.next}</button></div>
  </div>;
}

function Common({ userId, requestKey, labels }: { userId: string; requestKey: string; labels: InvestmentLabels }) {
  return <>
    <input type="hidden" name="user_id" value={userId} />
    <input type="hidden" name="client_key" value={requestKey} />
    <label className="admin-field admin-field-wide">{labels.note}<input name="note" required minLength={3} maxLength={300} placeholder={labels.notePlaceholder} /></label>
  </>;
}

/** Gives the client shares of a property, paid from the wallet or recorded as paid outside it. */
export function AddSharesForm({ userId, requestKey, properties, labels, lang }: { userId: string; requestKey: string; properties: PropertyOption[]; labels: InvestmentLabels; lang: string }) {
  const [state, action, pending] = useActionState(addClientShares, { result: "" } as InvestmentState);
  const [slug, setSlug] = useState(properties.length === 1 ? properties[0].slug : "");
  const selected = properties.find((property) => property.slug === slug);
  const [shares, setShares] = useState("1");
  const [price, setPrice] = useState(selected ? String(selected.sharePrice) : "");
  if (state.result === "saved") return <Saved labels={labels} />;
  const total = Number(shares) * Number(price.replace(",", "."));
  return <form action={action} className="admin-form">
    <div className="admin-form-grid">
      <label className="admin-field admin-field-wide">{labels.property}
        <select name="property_slug" required value={slug} onChange={(event) => { setSlug(event.target.value); const next = properties.find((property) => property.slug === event.target.value); if (next) setPrice(String(next.sharePrice)); }}>
          {properties.length !== 1 && <option value="" disabled>—</option>}
          {properties.map((property) => <option key={property.slug} value={property.slug} disabled={property.available < 1}>{property.title} · {money(property.sharePrice, lang)} · {property.available.toLocaleString(lang)} {labels.available}</option>)}
        </select>
      </label>
      <label className="admin-field">{labels.shares}<input name="shares" required type="number" min={1} max={selected?.available || undefined} step={1} value={shares} onChange={(event) => setShares(event.target.value)} /></label>
      <label className="admin-field">{labels.pricePerShare}<input name="price_per_share" required inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
      <fieldset className="admin-field admin-field-wide"><legend>{labels.payment}</legend>
        <label className="admin-check"><input type="radio" name="payment" value="wallet" defaultChecked /><span>{labels.fromWallet}</span></label>
        <label className="admin-check"><input type="radio" name="payment" value="external" /><span>{labels.outsideWallet}</span></label>
      </fieldset>
      <Common userId={userId} requestKey={requestKey} labels={labels} />
    </div>
    {Number.isFinite(total) && total > 0 && <p className="admin-help">{labels.total}: <strong>{money(total, lang)}</strong></p>}
    <label className="admin-check"><input type="checkbox" name="confirm" value="yes" required /><span>{labels.confirm}</span></label>
    <Result state={state} labels={labels} />
    <div><button disabled={pending} className="admin-btn"><ArrowDownToLine size={15} aria-hidden="true" />{labels.addSubmit}</button></div>
  </form>;
}

/** Buys shares back from the client: the holding shrinks, the wallet is credited and the shares become available.
 * With a sale request the request is completed in the same step. */
export function BuyBackForm({ userId, requestKey, holdings, labels, lang, saleRequestId, maxShares }: { userId: string; requestKey: string; holdings: HoldingOption[]; labels: InvestmentLabels; lang: string; saleRequestId?: string; maxShares?: number }) {
  const [state, action, pending] = useActionState(buyBackClientShares, { result: "" } as InvestmentState);
  const [slug, setSlug] = useState(holdings.length === 1 ? holdings[0].slug : "");
  const selected = holdings.find((holding) => holding.slug === slug);
  const limit = Math.min(selected?.shares ?? Infinity, maxShares ?? Infinity);
  const [shares, setShares] = useState(String(Number.isFinite(limit) ? limit : 1));
  const [price, setPrice] = useState(selected ? String(selected.sharePrice) : "");
  if (state.result === "saved") return <Saved labels={labels} />;
  const total = Number(shares) * Number(price.replace(",", "."));
  return <form action={action} className="admin-form">
    {saleRequestId && <input type="hidden" name="sale_request_id" value={saleRequestId} />}
    <div className="admin-form-grid">
      <label className="admin-field admin-field-wide">{labels.property}
        <select name="property_slug" required value={slug} onChange={(event) => { setSlug(event.target.value); const next = holdings.find((holding) => holding.slug === event.target.value); if (next) { setPrice(String(next.sharePrice)); setShares(String(Math.min(next.shares, maxShares ?? Infinity))); } }}>
          {holdings.length !== 1 && <option value="" disabled>—</option>}
          {holdings.map((holding) => <option key={holding.slug} value={holding.slug}>{holding.title} · {holding.shares.toLocaleString(lang)} {labels.held}</option>)}
        </select>
      </label>
      <label className="admin-field">{labels.shares}<input name="shares" required type="number" min={1} max={Number.isFinite(limit) ? limit : undefined} step={1} value={shares} onChange={(event) => setShares(event.target.value)} /></label>
      <label className="admin-field">{labels.pricePerShare}<input name="price_per_share" required inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
      <Common userId={userId} requestKey={requestKey} labels={labels} />
    </div>
    {Number.isFinite(total) && total > 0 && <p className="admin-help">{labels.total}: <strong>{money(total, lang)}</strong></p>}
    <label className="admin-check"><input type="checkbox" name="confirm" value="yes" required /><span>{labels.confirm}</span></label>
    <Result state={state} labels={labels} />
    <div><button disabled={pending} className="admin-btn"><ArrowUpFromLine size={15} aria-hidden="true" />{labels.buyBackSubmit}</button></div>
  </form>;
}

/** Corrects the wallet up or down with a reason the client sees in the statement. */
export function WalletAdjustForm({ userId, requestKey, labels }: { userId: string; requestKey: string; labels: InvestmentLabels }) {
  const [state, action, pending] = useActionState(adjustClientWallet, { result: "" } as InvestmentState);
  if (state.result === "saved") return <Saved labels={labels} />;
  return <form action={action} className="admin-form">
    <div className="admin-form-grid">
      <label className="admin-field">{labels.direction}
        <select name="direction" required defaultValue="credit">
          <option value="credit">{labels.addToWallet}</option>
          <option value="debit">{labels.subtractFromWallet}</option>
        </select>
      </label>
      <label className="admin-field">{labels.amount}<input name="amount" required inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" placeholder="100.00" /></label>
      <Common userId={userId} requestKey={requestKey} labels={labels} />
    </div>
    <label className="admin-check"><input type="checkbox" name="confirm" value="yes" required /><span>{labels.confirm}</span></label>
    <Result state={state} labels={labels} />
    <div><button disabled={pending} className="admin-btn"><Scale size={15} aria-hidden="true" />{labels.adjustSubmit}</button></div>
  </form>;
}

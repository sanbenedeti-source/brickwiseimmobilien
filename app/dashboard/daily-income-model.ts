export type IncomePurchase = { property_slug: string; shares: number; amount: number; currency: string; created_at: string };
/** accrualStart/paused come from the admin profit settings for the property. */
export type DailyIncomePosition = { slug: string; title: string; shares: number; rentalRate: number; accrualStart?: number | null; paused?: boolean };
export const INCOME_DAY_MS = 86_400_000;

/** Simple current-rate projection per purchase, after each completed 24 hours.
 * Never backdate additional shares to the first purchase or credit a wallet.
 * A lot starts accruing at the later of its purchase and the property's
 * activation date; a paused property accrues nothing.
 */
export function dailyIncome(position: DailyIncomePosition, purchases: IncomePurchase[], now: number) {
  const lots = purchases.filter(p => p.property_slug === position.slug);
  const complete = lots.length > 0 && lots.every(p => p.currency === "EUR" && Number.isSafeInteger(p.shares) && p.shares > 0 && Number.isFinite(p.amount) && p.amount > 0 && Number.isFinite(Date.parse(p.created_at)) && Date.parse(p.created_at) <= now)
    && lots.reduce((sum, p) => sum + p.shares, 0) === position.shares
    && Number.isFinite(position.rentalRate) && position.rentalRate >= 0
    && (position.accrualStart == null || Number.isFinite(position.accrualStart));
  if (!complete) return null;
  const rate = position.paused ? 0 : position.rentalRate;
  const from = (p: IncomePurchase) => Math.max(Date.parse(p.created_at), position.accrualStart ?? -Infinity);
  const daysAt = (p: IncomePurchase, at: number) => Math.max(0, Math.floor((at - from(p)) / INCOME_DAY_MS));
  const start = Math.min(...lots.map(p => Date.parse(p.created_at)));
  const accrualStart = Math.min(...lots.map(from));
  const capital = lots.reduce((sum, p) => sum + p.amount, 0);
  const accruedAt = (at: number) => lots.reduce((sum, p) => sum + p.amount * rate / 100 / 365 * daysAt(p, at), 0);
  return {
    start, accrualStart, paused: Boolean(position.paused), capital,
    days: Math.max(0, Math.floor((now - accrualStart) / INCOME_DAY_MS)),
    daily: capital * rate / 100 / 365,
    accrued: accruedAt(now),
    next: Math.min(...lots.map(p => from(p) + (daysAt(p, now) + 1) * INCOME_DAY_MS)),
    history: Array.from({ length: 14 }, (_, i) => {
      const at = now - i * INCOME_DAY_MS;
      return { at, profit: accruedAt(at) - accruedAt(at - INCOME_DAY_MS), total: accruedAt(at) };
    }),
    lots: lots.map(p => ({ ...p, days: daysAt(p, now), daily: p.amount * rate / 100 / 365 })),
  };
}

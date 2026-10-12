export type IncomePurchase = { property_slug: string; shares: number; amount: number; currency: string; created_at: string };
export type DailyIncomePosition = { slug: string; title: string; shares: number; rentalRate: number };
export const INCOME_DAY_MS = 86_400_000;

/** Simple current-rate projection per purchase, after each completed 24 hours.
 * Never backdate additional shares to the first purchase or credit a wallet.
 */
export function dailyIncome(position: DailyIncomePosition, purchases: IncomePurchase[], now: number) {
  const lots = purchases.filter(p => p.property_slug === position.slug);
  const complete = lots.length > 0 && lots.every(p => p.currency === "EUR" && Number.isSafeInteger(p.shares) && p.shares > 0 && Number.isFinite(p.amount) && p.amount > 0 && Number.isFinite(Date.parse(p.created_at)) && Date.parse(p.created_at) <= now)
    && lots.reduce((sum, p) => sum + p.shares, 0) === position.shares
    && Number.isFinite(position.rentalRate) && position.rentalRate >= 0;
  if (!complete) return null;
  const start = Math.min(...lots.map(p => Date.parse(p.created_at)));
  const capital = lots.reduce((sum, p) => sum + p.amount, 0);
  const accruedAt = (at: number) => lots.reduce((sum, p) => sum + p.amount * position.rentalRate / 100 / 365 * Math.max(0, Math.floor((at - Date.parse(p.created_at)) / INCOME_DAY_MS)), 0);
  return {
    start, capital, days: Math.floor((now - start) / INCOME_DAY_MS),
    daily: capital * position.rentalRate / 100 / 365,
    accrued: accruedAt(now),
    next: Math.min(...lots.map(p => Date.parse(p.created_at) + (Math.floor((now - Date.parse(p.created_at)) / INCOME_DAY_MS) + 1) * INCOME_DAY_MS)),
    history: Array.from({ length: 14 }, (_, i) => {
      const at = now - i * INCOME_DAY_MS;
      return { at, profit: accruedAt(at) - accruedAt(at - INCOME_DAY_MS), total: accruedAt(at) };
    }),
    lots: lots.map(p => ({ ...p, days: Math.floor((now - Date.parse(p.created_at)) / INCOME_DAY_MS), daily: p.amount * position.rentalRate / 100 / 365 })),
  };
}

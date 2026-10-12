export type IncomePosition = {
  slug: string;
  title: string;
  city: string;
  imageUrl: string;
  shares: number;
  recordedInvestment: { amount: number; currency: string };
  sharePrice: number;
  annualRate: number;
  totalShares: number;
  availableShares: number;
  monthlyRent: number;
  monthlyExpenses: number;
};

export function positionEconomics(position: IncomePosition) {
  const ownership = position.totalShares > 0 ? position.shares / position.totalShares : 0;
  const capital = position.shares * position.sharePrice;
  const annual = capital * position.annualRate / 100;
  return {
    ownership,
    capital,
    annual,
    monthly: annual / 12,
    rentalMonthly: (position.monthlyRent - position.monthlyExpenses) * ownership,
    averageCost: position.shares > 0 ? position.recordedInvestment.amount / position.shares : 0,
  };
}

export function simulatePosition(position: IncomePosition, requestedShares: number, months: number) {
  const extraShares = Math.min(Math.max(0, Math.floor(Number.isFinite(requestedShares) ? requestedShares : 0)), Math.max(0, Math.floor(position.availableShares)));
  const extraInvestment = extraShares * position.sharePrice;
  const capital = position.shares * position.sharePrice + extraInvestment;
  const annual = capital * position.annualRate / 100;
  const profit = annual * months / 12;
  return { extraShares, extraInvestment, capital, annual, profit, capitalAndProfit: capital + profit };
}

import { type PriceInfo } from "@zoonk/utils/currency";

type PlanPrices = { monthlyPrice: PriceInfo | null; yearlyPrice: PriceInfo | null };

const MONTHS_PER_YEAR = 12;

export function getMonthlyEquivalent({
  yearlyPrice,
}: {
  yearlyPrice: PriceInfo | null;
}): PriceInfo | null {
  if (!yearlyPrice) {
    return null;
  }

  return {
    amount: Math.round(yearlyPrice.amount / MONTHS_PER_YEAR),
    currency: yearlyPrice.currency,
  };
}

/** A yearly-savings claim only when Stripe's prices share a currency and the annual total is really lower. */
export function getYearlyPriceComparison({ monthlyPrice, yearlyPrice }: PlanPrices) {
  if (!monthlyPrice || !yearlyPrice) {
    return null;
  }

  if (monthlyPrice.currency !== yearlyPrice.currency) {
    return null;
  }

  const originalAmount = monthlyPrice.amount * MONTHS_PER_YEAR;
  const savedAmount = originalAmount - yearlyPrice.amount;

  if (savedAmount <= 0) {
    return null;
  }

  return {
    discountedPrice: yearlyPrice,
    originalPrice: { amount: originalAmount, currency: monthlyPrice.currency },
    savings: { amount: savedAmount, currency: yearlyPrice.currency },
  };
}

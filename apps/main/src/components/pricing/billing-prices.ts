import { type PriceInfo } from "@zoonk/utils/currency";

type PlanPrices = { monthlyPrice: PriceInfo | null; yearlyPrice: PriceInfo | null };

const MONTHS_PER_YEAR = 12;

/**
 * Turns the yearly total into the closest monthly amount the currency can
 * display. The exact yearly charge stays visible beside this comparison.
 */
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

/**
 * The single Plus offer can make a yearly-savings claim only when Stripe proves
 * that its monthly and yearly prices use the same currency and the annual total
 * is genuinely lower. Missing or incomparable prices produce no claim.
 */
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

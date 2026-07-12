import { type PriceInfo } from "@zoonk/utils/currency";

type PlanPrices = { monthlyPrice: PriceInfo | null; yearlyPrice: PriceInfo | null };

/**
 * The single Plus offer can make a yearly-savings claim only when Stripe proves
 * that its monthly and yearly prices use the same currency and the annual total
 * is genuinely lower. Missing or incomparable prices produce no claim.
 */
export function getYearlySavings({ monthlyPrice, yearlyPrice }: PlanPrices): PriceInfo | null {
  if (!monthlyPrice || !yearlyPrice) {
    return null;
  }

  if (monthlyPrice.currency !== yearlyPrice.currency) {
    return null;
  }

  const savedAmount = monthlyPrice.amount * 12 - yearlyPrice.amount;

  if (savedAmount <= 0) {
    return null;
  }

  return { amount: savedAmount, currency: yearlyPrice.currency };
}

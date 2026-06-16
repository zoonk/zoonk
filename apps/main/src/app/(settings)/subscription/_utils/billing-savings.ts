import { type PriceInfo } from "@zoonk/utils/currency";

type PlanPrices = { monthlyPrice: PriceInfo | null; yearlyPrice: PriceInfo | null };

/**
 * The yearly tab needs one honest savings claim even though each paid tier has
 * its own Stripe prices. Showing the largest proven same-currency discount
 * lets the tab stay compact without implying savings when price data is
 * missing, mismatched, or not actually discounted.
 */
export function getLargestYearlySavings(plans: PlanPrices[]): PriceInfo | null {
  const savings = plans
    .map((plan) => getYearlySavings(plan))
    .filter((yearlySavings) => isPriceInfo(yearlySavings));

  const displayCurrency = savings[0]?.currency;

  if (!displayCurrency) {
    return null;
  }

  const comparableSavings = savings.filter(
    (yearlySavings) => yearlySavings.currency === displayCurrency,
  );

  return comparableSavings.toSorted(compareSavingsDescending)[0] ?? null;
}

/**
 * Stripe can return fallback prices in a different currency than the preferred
 * locale price. Comparing different currencies would create a fake savings
 * amount, so this only returns a discount when both prices share a currency.
 */
function getYearlySavings({ monthlyPrice, yearlyPrice }: PlanPrices): PriceInfo | null {
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

/**
 * This type guard keeps the public helper free to use nullable intermediate
 * results while still returning a concrete PriceInfo object to the component.
 */
function isPriceInfo(value: PriceInfo | null): value is PriceInfo {
  return value !== null;
}

/**
 * Sorting by amount puts the strongest annual-savings claim first, which is
 * the number shown in the compact yearly-tab badge.
 */
function compareSavingsDescending(a: PriceInfo, b: PriceInfo): number {
  return b.amount - a.amount;
}

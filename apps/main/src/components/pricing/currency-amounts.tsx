import { type PlusPriceTable } from "@/data/subscriptions/get-plus-price-table";
import { BILLING_CURRENCIES, type PriceInfo } from "@zoonk/utils/currency";
import { type ReactNode } from "react";
import { formatPlanPrice } from "./plan-price";

type Plan = "monthly" | "yearly";

/**
 * The billing currencies in groups that pay the same for both plans (Stripe prices a currency
 * without its own option in the plan's own currency), so each group needs one version of a price.
 */
function getCurrencyGroups(prices: PlusPriceTable): string[][] {
  const groups = Map.groupBy(BILLING_CURRENCIES, (currency) =>
    JSON.stringify([prices.monthly?.[currency], prices.yearly?.[currency]]),
  );

  return [...groups.values()];
}

/**
 * One version of a price, or of a line about it, per group of currencies paying the same, of which
 * `BillingCurrencyScope` shows the reader's: each version is its own `as` element with
 * `className`, naming its currencies in `data-currency`. `render` draws a group's content from its
 * price for `plan`; null leaves that group without a version.
 */
export function CurrencyVariants({
  as: Element = "span",
  className,
  plan,
  prices,
  render,
}: {
  as?: "p" | "span";
  className?: string;
  plan: Plan;
  prices: PlusPriceTable;
  render: (price: PriceInfo, currency: string) => ReactNode;
}) {
  const planPrices = prices[plan];

  if (!planPrices) {
    return null;
  }

  return getCurrencyGroups(prices).map((currencies) => {
    const [currency = ""] = currencies;
    const price = planPrices[currency];
    const content = price ? render(price, currency) : null;

    return content === null ? null : (
      <Element className={className} data-currency={currencies.join(" ")} key={currency}>
        {content}
      </Element>
    );
  });
}

/** A plan's price in each billing currency, as the plans show prices. */
export function CurrencyAmounts({
  locale,
  plan,
  prices,
}: {
  locale: string;
  plan: Plan;
  prices: PlusPriceTable;
}) {
  return (
    <CurrencyVariants
      plan={plan}
      prices={prices}
      render={(price) => formatPlanPrice({ locale, price })}
    />
  );
}

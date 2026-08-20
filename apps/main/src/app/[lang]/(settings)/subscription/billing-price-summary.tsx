"use client";

import { type PriceInfo, formatPrice } from "@zoonk/utils/currency";
import { useExtracted, useLocale } from "next-intl";
import { getMonthlyEquivalent, getYearlyPriceComparison } from "./_utils/billing-prices";

export type BillingPeriod = "monthly" | "yearly";

function renderOriginalPrice(chunks: React.ReactNode) {
  return <del>{chunks}</del>;
}

function renderDiscountedPrice(chunks: React.ReactNode) {
  return <span className="text-foreground font-medium">{chunks}</span>;
}

/**
 * Keeps the comparable monthly amount prominent while fitting the exact yearly
 * charge and its crossed-out monthly total into one quiet secondary line.
 */
export function BillingPriceSummary({
  monthlyPrice,
  period,
  yearlyPrice,
}: {
  monthlyPrice: PriceInfo | null;
  period: BillingPeriod;
  yearlyPrice: PriceInfo | null;
}) {
  const t = useExtracted();
  const locale = useLocale();
  const price = period === "monthly" ? monthlyPrice : getMonthlyEquivalent({ yearlyPrice });
  const yearlyComparison = getYearlyPriceComparison({ monthlyPrice, yearlyPrice });
  const priceLabel = formatOptionalPrice({ locale, price });
  const yearlyPriceLabel = formatOptionalPrice({ locale, price: yearlyPrice });

  const yearlyOriginalPriceLabel = formatOptionalPrice({
    locale,
    price: yearlyComparison?.originalPrice ?? null,
  });

  const yearlyDiscountedPriceLabel = formatOptionalPrice({
    locale,
    price: yearlyComparison?.discountedPrice ?? null,
  });

  const yearlyBillingLabel = yearlyPriceLabel
    ? t("{amount} billed yearly", { amount: yearlyPriceLabel })
    : null;

  const yearlyComparisonLabel =
    yearlyOriginalPriceLabel && yearlyDiscountedPriceLabel
      ? t.rich(
          "From <original>{originalAmount}</original> to <discounted>{discountedAmount}</discounted> per year",
          {
            discounted: renderDiscountedPrice,
            discountedAmount: yearlyDiscountedPriceLabel,
            original: renderOriginalPrice,
            originalAmount: yearlyOriginalPriceLabel,
          },
        )
      : null;

  return (
    <div className="flex min-h-24 flex-col justify-center gap-1">
      {priceLabel ? (
        <p className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight tabular-nums">{priceLabel}</span>
          <span className="text-muted-foreground text-sm">{t("per month")}</span>
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">{t("Price shown at checkout")}</p>
      )}

      <div className="min-h-5">
        {period === "yearly" && (yearlyComparisonLabel || yearlyBillingLabel) && (
          <p className="text-muted-foreground text-sm">
            {yearlyComparisonLabel ?? yearlyBillingLabel}
          </p>
        )}
      </div>
    </div>
  );
}

function formatOptionalPrice({ locale, price }: { locale: string; price: PriceInfo | null }) {
  return price ? formatPrice(price.amount, price.currency, locale) : null;
}

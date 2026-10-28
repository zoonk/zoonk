import { type PriceInfo, formatPrice } from "@zoonk/utils/currency";

/** A narrow no-break space, so the mono face never opens a wide gap in "R$ 49" or splits it across lines. */
export function formatPlanPrice({ locale, price }: { locale: string; price: PriceInfo }): string {
  return formatPrice(price.amount, price.currency, locale).replaceAll(" ", " ");
}

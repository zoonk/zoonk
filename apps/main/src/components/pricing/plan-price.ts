import { type PriceInfo, formatPrice } from "@zoonk/utils/currency";

/**
 * A price as the plans show it, in the reader's currency: the space a locale puts between the
 * symbol and the number becomes a narrow no-break one, so the mono face never opens a wide gap in
 * "R$ 49", and the two never split across lines.
 */
export function formatPlanPrice({ locale, price }: { locale: string; price: PriceInfo }): string {
  return formatPrice(price.amount, price.currency, locale).replaceAll(" ", " ");
}

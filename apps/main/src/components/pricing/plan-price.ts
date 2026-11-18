import { type PriceInfo, formatPrice } from "@zoonk/utils/currency";

export function formatPlanPrice({ locale, price }: { locale: string; price: PriceInfo }): string {
  return formatPrice(price.amount, price.currency, locale, { compactCurrency: true });
}

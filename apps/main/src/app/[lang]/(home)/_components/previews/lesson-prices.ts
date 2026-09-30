import { type SupportedLocale } from "@zoonk/utils/locale";
import { getFormatter } from "next-intl/server";

/** Example prices use the local currency, so the numbers feel familiar. */
export const EXAMPLE_CURRENCY: Record<SupportedLocale, string> = {
  de: "EUR",
  en: "USD",
  es: "EUR",
  fr: "EUR",
  pt: "BRL",
};

const PRICE_BEFORE = 80;
const PRICE_AFTER = 60;
const DISCOUNT = 20;

export type LessonPrices = { after: string; before: string; discount: string };

/** The discount lesson's prices ($80 becomes $60), in the page's currency and format. */
export async function getLessonPrices(locale: SupportedLocale): Promise<LessonPrices> {
  const format = await getFormatter();

  const money = (value: number) =>
    format.number(value, {
      currency: EXAMPLE_CURRENCY[locale],
      maximumFractionDigits: 0,
      style: "currency",
    });

  return { after: money(PRICE_AFTER), before: money(PRICE_BEFORE), discount: money(DISCOUNT) };
}

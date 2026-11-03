import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES, type SupportedLocale, getFormattingLocale } from "./locale";
import { repairNegativeMoney } from "./negative-money";

/** Each locale's own money, as its lessons write it (`LOCAL_CONTEXT`). */
const LOCAL_MONEY: Record<SupportedLocale, { currency: string; mark: string }> = {
  de: { currency: "EUR", mark: "€" },
  en: { currency: "USD", mark: "$" },
  es: { currency: "MXN", mark: "$" },
  fr: { currency: "EUR", mark: "€" },
  it: { currency: "EUR", mark: "€" },
  ja: { currency: "JPY", mark: "¥" },
  ko: { currency: "KRW", mark: "₩" },
  pl: { currency: "PLN", mark: "zł" },
  pt: { currency: "BRL", mark: "R$" },
  tr: { currency: "TRY", mark: "₺" },
};

function intlMoney({
  digits,
  locale,
  value,
}: {
  digits: number;
  locale: SupportedLocale;
  value: number;
}) {
  return new Intl.NumberFormat(getFormattingLocale(locale), {
    currency: LOCAL_MONEY[locale].currency,
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
    style: "currency",
  }).format(value);
}

describe(repairNegativeMoney, () => {
  it("writes a negative amount the way pt-BR and en-US do", () => {
    expect(repairNegativeMoney({ language: "pt", text: "Ele seria R$ -2.000,00 no fim." })).toBe(
      "Ele seria -R$ 2.000,00 no fim.",
    );

    expect(repairNegativeMoney({ language: "en", text: "| Equity | $-1,500 |" })).toBe(
      "| Equity | -$1,500 |",
    );
  });

  it.each(SUPPORTED_LOCALES)(
    "moves the minus where %s writes it, keeping the amount's digits",
    (locale) => {
      const digits = locale === "ja" || locale === "ko" ? 0 : 2;

      const amount = new Intl.NumberFormat(getFormattingLocale(locale), {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(1234.5);

      const text = `${LOCAL_MONEY[locale].mark} -${amount}`;

      expect(repairNegativeMoney({ language: locale, text })).toBe(
        intlMoney({ digits, locale, value: -Number(amount.replaceAll(/\D/gu, "")) / 10 ** digits }),
      );
    },
  );

  it("leaves amounts already written the locale's way, and minus signs that aren't money", () => {
    const text = "Saldo: -R$ 2.000,00; temperatura -3 °C; R$ 500,00.";

    expect(repairNegativeMoney({ language: "pt", text })).toBe(text);
  });
});

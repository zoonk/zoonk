"use client";

import {
  formatLocalizedNumber,
  fractionDigitsFor,
  parseLocalizedNumber,
} from "@zoonk/utils/localized-number";
import { currencyFor, formatMoney, withUnit } from "@zoonk/utils/math-answer";
import { useExtracted, useLocale } from "next-intl";

type FormatOptions = {
  compact?: boolean;
  grouping?: boolean;
  maximumFractionDigits?: number;
  signed?: boolean;
  unit?: string;
};

function splitMoneyUnit(unit?: string): { currency: string; rest: string } | null {
  const whole = currencyFor(unit);

  if (whole || !unit) {
    return whole ? { currency: whole, rest: "" } : null;
  }

  const [head, ...rest] = unit.split(" ");
  const currency = currencyFor(head);

  return currency && rest.length > 0 ? { currency, rest: rest.join(" ") } : null;
}

export function useFormatNumber() {
  const locale = useLocale();
  const t = useExtracted();

  const seconds = (count: number) =>
    t("{count, plural, =0 {seconds} one {second} other {seconds}}", { count });

  const atoms = (count: number) =>
    t("{count, plural, =0 {atoms} one {atom} other {atoms}}", { count });

  return (value: number, options: FormatOptions = {}) => {
    const money = splitMoneyUnit(options.unit);

    if (money) {
      const amount = formatMoney({
        compact: options.compact,
        currency: money.currency,
        locale,
        maximumFractionDigits: options.maximumFractionDigits,
        signed: options.signed,
        value,
      });

      return money.rest ? `${amount} ${money.rest}` : amount;
    }

    const formatted = formatLocalizedNumber({
      compact: options.compact,
      grouping: options.grouping,
      locale,
      maximumFractionDigits: options.maximumFractionDigits ?? fractionDigitsFor(value),
      signed: options.signed,
      value,
    });

    if (!options.unit) {
      return formatted;
    }

    const formatUnit = [seconds, atoms].find(
      (unit) => options.unit === unit(1) || options.unit === unit(2),
    );

    if (!formatUnit) {
      return withUnit(formatted, options.unit);
    }

    const count = Math.abs(parseLocalizedNumber({ locale, text: formatted }) ?? value);
    return withUnit(formatted, formatUnit(count));
  };
}

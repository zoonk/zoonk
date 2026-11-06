"use client";

import {
  formatLocalizedNumber,
  fractionDigitsFor,
  getNumberFormatter,
  parseLocalizedNumber,
} from "@zoonk/utils/localized-number";
import { currencyFor, formatMoney, moneyFractionDigits, withUnit } from "@zoonk/utils/math-answer";
import { useExtracted } from "next-intl";
import { useAppLocale } from "./locale";

type FormatOptions = {
  compact?: boolean;
  grouping?: boolean;
  maximumFractionDigits?: number;
  percent?: boolean;
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

export function displayDigits(value: number, unit?: string): number {
  return splitMoneyUnit(unit) ? moneyFractionDigits(value) : fractionDigitsFor(value);
}

/** `Intl` rounds as `format` does: 1.005 to 1.01, where `toFixed` gives 1.00. */
export function roundForDisplay(value: number, unit?: string): number {
  const maximumFractionDigits = displayDigits(value, unit);
  const formatter = getNumberFormatter("en", { maximumFractionDigits, useGrouping: false });
  return Number(formatter.format(value));
}

export function useFormatNumber() {
  const locale = useAppLocale();
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
      percent: options.percent,
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

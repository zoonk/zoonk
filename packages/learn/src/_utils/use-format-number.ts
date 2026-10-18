"use client";

import {
  formatLocalizedNumber,
  fractionDigitsFor,
  parseLocalizedNumber,
} from "@zoonk/utils/localized-number";
import { currencyFor, formatMoney, withUnit } from "@zoonk/utils/math-answer";
import { useExtracted, useLocale } from "next-intl";

type FormatOptions = {
  /** Short forms like "1.2M" for axis ticks. */
  compact?: boolean;
  /** Off for values like years, which read wrong as "1,960". */
  grouping?: boolean;
  maximumFractionDigits?: number;
  signed?: boolean;
  unit?: string;
};

/**
 * The money part of a unit and what follows it: "R$ por metro" is money per meter, so it reads
 * "R$ 7 por metro" rather than "7 R$ por metro".
 */
function splitMoneyUnit(unit?: string): { currency: string; rest: string } | null {
  const whole = currencyFor(unit);

  if (whole || !unit) {
    return whole ? { currency: whole, rest: "" } : null;
  }

  const [head, ...rest] = unit.split(" ");
  const currency = currencyFor(head);

  return currency && rest.length > 0 ? { currency, rest: rest.join(" ") } : null;
}

/**
 * Formats numbers in the learner's language, with the activity's unit when given, the way math
 * answers write units (`@zoonk/utils/math-answer`): money units ("$", "R$", "EUR") follow the
 * language's currency format.
 */
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

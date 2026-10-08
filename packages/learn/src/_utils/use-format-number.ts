"use client";

import { formatLocalizedNumber, fractionDigitsFor } from "@zoonk/utils/localized-number";
import { currencyFor, formatMoney, withUnit } from "@zoonk/utils/math-answer";
import { useLocale } from "next-intl";

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

    return withUnit(
      formatLocalizedNumber({
        compact: options.compact,
        grouping: options.grouping,
        locale,
        maximumFractionDigits: options.maximumFractionDigits ?? fractionDigitsFor(value),
        signed: options.signed,
        value,
      }),
      options.unit,
    );
  };
}

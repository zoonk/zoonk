"use client";
import { useFormatNumber } from "@zoonk/learn/format-number";
import { splitMoneyUnit } from "@zoonk/utils/math-answer";
import { useExtracted } from "next-intl";

export function useGuessFormat(unit?: string) {
  const format = useFormatNumber();
  const t = useExtracted();
  const money = splitMoneyUnit(unit) !== null;

  const label =
    unit && !money
      ? t({
          description:
            "Labels a scale's numbers with what they count or measure; {unit} is the activity's own unit text, such as days, km/h or times.",
          message: "Unit: {unit}",
          values: { unit },
        })
      : null;

  const value = (number: number) => format(number, { unit: money ? unit : undefined });

  return {
    accessible: (number: number) => [value(number), label].filter(Boolean).join(". "),
    label,
    money,
    value,
  };
}

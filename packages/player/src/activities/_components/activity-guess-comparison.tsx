"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { useExtracted } from "next-intl";
import { compareGuess } from "../_utils/guess-scale";

/** How far the guess landed from the real value, in plain words computed by code. */
export function ActivityGuessComparison({
  actual,
  guess,
  isCorrect,
  unit,
}: {
  actual: number;
  guess: number;
  isCorrect: boolean;
  unit: string;
}) {
  const t = useExtracted();
  const format = useFormatNumber();
  const comparison = compareGuess({ actual, guess, isCorrect });

  if (comparison.kind === "close") {
    return <p className="text-sm font-medium">{t("Your guess is close to the real value.")}</p>;
  }

  if (comparison.kind === "off") {
    return (
      <p className="text-sm font-medium">
        {t("Your guess is off by {difference}.", {
          difference: format(Math.abs(comparison.difference), { unit }),
        })}
      </p>
    );
  }

  return (
    <p className="text-sm font-medium">
      {comparison.kind === "tooBig"
        ? t("Your guess is about {times} times too big.", { times: format(comparison.times) })
        : t("Your guess is about {times} times too small.", { times: format(comparison.times) })}
    </p>
  );
}

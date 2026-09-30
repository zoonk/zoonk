"use client";

import { useExtracted } from "next-intl";
import { compareGuess } from "../_utils/guess-scale";
import { useFormatNumber } from "../_utils/use-format-number";

/** How far the guess landed from the real value, in plain words computed by code. */
export function ActivityGuessComparison({
  actual,
  guess,
  unit,
}: {
  actual: number;
  guess: number;
  unit: string;
}) {
  const t = useExtracted();
  const format = useFormatNumber();
  const comparison = compareGuess(guess, actual);

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

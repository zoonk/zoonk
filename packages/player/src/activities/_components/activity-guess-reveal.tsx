"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { useExtracted } from "next-intl";
import { type GuessScale } from "../_utils/guess-scale";
import { ActivityCanvas, ActivityTextAlternative } from "./activity-canvas";
import { ActivityGuessComparison } from "./activity-guess-comparison";
import { ActivityGuessScale } from "./activity-guess-scale";

/**
 * Guess on a linear or log scale first; once checked, the guess is locked and the real value
 * shows on the same scale beside it, followed by what explains it (the children).
 */
export function ActivityGuessReveal({
  actual,
  children,
  guess,
  isChecked,
  labelId,
  onGuessChange,
  scale,
  unit,
}: {
  actual: number | null;
  children: React.ReactNode;
  guess: number | null;
  isChecked: boolean;
  labelId: string;
  onGuessChange: (value: number) => void;
  scale: GuessScale;
  unit: string;
}) {
  const t = useExtracted();
  const format = useFormatNumber();
  const formatValue = (value: number) => format(value, { unit });
  const revealed = isChecked ? actual : null;

  return (
    <ActivityCanvas labelId={labelId}>
      <ActivityGuessScale
        actual={revealed}
        disabled={isChecked}
        guess={guess}
        onGuessChange={onGuessChange}
        scale={scale}
        unit={unit}
      />

      {revealed !== null && (
        <div className="flex flex-col gap-3">
          {guess !== null && (
            <ActivityGuessComparison actual={revealed} guess={guess} unit={unit} />
          )}
          {children}
        </div>
      )}

      <ActivityTextAlternative>
        {revealed === null
          ? t("A scale from {min} to {max}.", {
              max: formatValue(scale.max),
              min: formatValue(scale.min),
            })
          : t("A scale from {min} to {max}. The real value is {actual}.", {
              actual: formatValue(revealed),
              max: formatValue(scale.max),
              min: formatValue(scale.min),
            })}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}

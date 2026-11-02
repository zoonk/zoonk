"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { useExtracted } from "next-intl";
import { type GuessScale } from "../_utils/guess-scale";
import { ActivityCanvas, ActivityTextAlternative } from "./activity-canvas";
import { ActivityGuessComparison } from "./activity-guess-comparison";
import { ActivityGuessScale } from "./activity-guess-scale";

export function ActivityGuessReveal({
  actual,
  children,
  guess,
  isChecked,
  isCorrect,
  labelId,
  onGuessChange,
  scale,
  unit,
}: {
  actual: number | null;
  children: React.ReactNode;
  guess: number | null;
  isChecked: boolean;
  isCorrect: boolean;
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
            <ActivityGuessComparison
              actual={revealed}
              guess={guess}
              isCorrect={isCorrect}
              unit={unit}
            />
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

"use client";

import { type ExamView } from "@zoonk/core/exams/view/contract";
import { useExtracted } from "next-intl";

type ScoreRange = Pick<NonNullable<ExamView["estimate"]>, "high" | "low" | "scale">;

/**
 * An estimated score range the way the exam reports it: "61% to 72%", "1130 to 1260" on the SAT's
 * scale, "3 to 4" for AP, "Band 4.5 to 5" for TOEFL. A range whose ends meet reads as one score.
 */
export function useScoreRange() {
  const t = useExtracted();

  return ({ high, low, scale }: ScoreRange): string => {
    const single = high === low;

    if (scale === "percent") {
      return single
        ? t("{score, number}%", { score: low })
        : t("{low, number}% to {high, number}%", { high, low });
    }

    if (scale === "toefl") {
      return single
        ? t("Band {score, number}", { score: low })
        : t("Band {low, number} to {high, number}", { high, low });
    }

    // Whole-number scales read as their score reports print them: "1170", never "1,170".
    return single ? String(low) : t("{low} to {high}", { high: String(high), low: String(low) });
  };
}

"use client";

import { type ExamView } from "@zoonk/core/exams/view/contract";
import { useExtracted } from "next-intl";
import { useFormatter } from "./formatter";

type ScoreRange = Pick<NonNullable<ExamView["estimate"]>, "high" | "low" | "scale">;

export function useScoreRange() {
  const t = useExtracted();
  const format = useFormatter();

  return ({ high, low, scale }: ScoreRange): string => {
    const single = high === low;
    // ICU `{n, number}` formats with the route's locale, Spain's for `es`, so scores come formatted.
    const scores = { high: format.number(high), low: format.number(low) };

    if (scale === "percent") {
      return single ? t("{score}%", { score: scores.low }) : t("{low}% to {high}%", scores);
    }

    if (scale === "toefl") {
      return single ? t("Band {score}", { score: scores.low }) : t("Band {low} to {high}", scores);
    }

    // Whole-number scales read as their score reports print them: "1170", never "1,170".
    return single ? String(low) : t("{low} to {high}", { high: String(high), low: String(low) });
  };
}

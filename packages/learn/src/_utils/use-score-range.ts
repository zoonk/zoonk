"use client";

import { type ExamView } from "@zoonk/core/exams/view/contract";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatRange } from "./range";

type ScoreRange = Pick<NonNullable<ExamView["estimate"]>, "high" | "low" | "scale">;

export function useScoreRange() {
  const t = useExtracted();
  const format = useFormatter();
  const formatRange = useFormatRange();

  return ({ high, low, scale }: ScoreRange): string => {
    if (scale === "percent") {
      const percent = (score: number) => t("{score}%", { score: format.number(score) });
      return formatRange(percent(low), percent(high));
    }

    if (scale === "toefl") {
      return t("Band {score}", { score: formatRange(format.number(low), format.number(high)) });
    }

    // Whole-number scales read as their score reports print them: "1170", never "1,170".
    return formatRange(String(low), String(high));
  };
}

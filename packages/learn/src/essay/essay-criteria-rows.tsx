"use client";

import { type EssayDraft } from "@zoonk/core/exams/essays/contract";
import { useExtracted } from "next-intl";
import { Meter, MeterFill } from "../_components/meter";
import { StepRow, StepRows } from "../_components/step-card";
import { useCriterionName, useFormatScore } from "./essay-labels";

type Grade = EssayDraft["grade"];

type Criterion = Grade["criteria"][number];

/**
 * A custom rubric's criteria each show on the total's scale, so three read "10 of 10", never "3.34
 * · 3.33 · 3.33".
 */
function toShownScore({
  criterion,
  rubric,
  total,
}: {
  criterion: Criterion;
  rubric: string;
  total: Grade["total"];
}): { max: number; score: number } {
  if (rubric !== "custom" || criterion.maxScore <= 0) {
    return { max: criterion.maxScore, score: criterion.score };
  }

  return { max: total.maxScore, score: (criterion.score / criterion.maxScore) * total.maxScore };
}

/** `meter` is off in a side panel, where the bar would push each name onto two lines. */
export function CriteriaRows({
  grade,
  meter = true,
  rubric,
}: {
  grade: Grade;
  meter?: boolean;
  rubric: string;
}) {
  const t = useExtracted();
  const criterionName = useCriterionName();
  const formatScore = useFormatScore();

  return (
    <StepRows aria-label={t("Score by criterion")}>
      {grade.criteria.map((criterion) => {
        const share = criterion.maxScore > 0 ? criterion.score / criterion.maxScore : 0;
        const shown = toShownScore({ criterion, rubric, total: grade.total });

        return (
          <StepRow key={criterion.id}>
            <span className="min-w-0 flex-1">{criterionName(criterion)}</span>
            {meter && (
              <Meter className="w-16 shrink-0 sm:w-20">
                <MeterFill share={share} />
              </Meter>
            )}
            <span className="shrink-0 text-right font-mono text-xs whitespace-nowrap tabular-nums">
              {t("{score} of {max}", {
                max: formatScore(shown.max),
                score: formatScore(shown.score),
              })}
            </span>
          </StepRow>
        );
      })}
    </StepRows>
  );
}

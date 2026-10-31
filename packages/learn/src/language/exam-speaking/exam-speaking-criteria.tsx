"use client";

import {
  type ExamSpeakingFeedbackView,
  type SpeakingCriterionView,
} from "@zoonk/core/language/exam-speaking/contract";
import { useExtracted } from "next-intl";
import { DetailsDrawer } from "../../_components/details-drawer";
import { useCriterionGloss, useEstimateText, useStandingText } from "./exam-speaking-labels";

type GradedCriterion = {
  criterion: SpeakingCriterionView;
  grade: ExamSpeakingFeedbackView["criteria"][number];
};

export function CriteriaDetails({
  graded,
  language,
  level,
}: {
  graded: readonly GradedCriterion[];
  language: string;
  level: string;
}) {
  const t = useExtracted();
  const gloss = useCriterionGloss();
  const estimateText = useEstimateText();
  const standingText = useStandingText();

  return (
    <DetailsDrawer label={t("See every criterion")} title={t("By criterion")}>
      <ul className="flex flex-col gap-4">
        {graded.map(({ criterion, grade }) => (
          <li className="flex flex-col gap-1 text-sm" key={criterion.key}>
            <p className="font-semibold">
              {t("{criterion} · {estimate} · {standing}", {
                criterion: gloss(criterion),
                estimate: estimateText(grade.estimate),
                standing: standingText(grade.standing, level),
              })}
            </p>
            <p className="text-muted-foreground text-xs" lang={language}>
              {criterion.name}
            </p>
            <p className="text-muted-foreground">{grade.evidence}</p>
            <p>{grade.tip}</p>
          </li>
        ))}
      </ul>
    </DetailsDrawer>
  );
}

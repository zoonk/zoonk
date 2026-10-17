"use client";

import {
  type ExamSpeakingFeedback,
  type SpeakingCriterionView,
} from "@zoonk/core/language/exam-speaking/contract";
import { useExtracted } from "next-intl";
import { DetailsDrawer } from "../../_components/details-drawer";
import { useBandText, useCriterionGloss, useStandingText } from "./exam-speaking-labels";

type GradedCriterion = {
  criterion: SpeakingCriterionView;
  grade: ExamSpeakingFeedback["criteria"][number];
};

/** Every criterion the task was rated on, with its estimate, where it stands, what was heard and a tip. */
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
  const band = useBandText();
  const standingText = useStandingText();

  return (
    <DetailsDrawer label={t("See every criterion")} title={t("By criterion")}>
      <ul className="flex flex-col gap-4">
        {graded.map(({ criterion, grade }) => (
          <li className="flex flex-col gap-1 text-sm" key={criterion.key}>
            <p className="font-semibold">
              {t("{criterion} · {estimate} · {standing}", {
                criterion: gloss(criterion),
                estimate: band(grade, criterion),
                standing: standingText(grade, criterion, level).text,
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

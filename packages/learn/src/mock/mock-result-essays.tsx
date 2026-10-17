"use client";

import { type MockEssayView } from "@zoonk/core/exams/mocks/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { useExtracted } from "next-intl";
import { StepCard, StepDetail, StepEyebrow, StepHeader, StepTitle } from "../_components/step-card";
import { type StepsItem } from "../_components/steps";
import { EssayGradeCard, NextStepComment } from "../essay/essay-feedback";
import { useWritingName } from "../essay/essay-labels";
import { useMockScreen } from "./mock-context";

/** Grading takes ten to thirty seconds; past this the line says it's taking longer. */
const SLOW_GRADING_MS = 30_000;

/** Where an essay not graded yet stands, and the way to grade it when nothing is running. */
function PendingState() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const status = runner.essayGrading;
  const isSlow = useTakingLong({ active: status === "grading", afterMs: SLOW_GRADING_MS });

  if (status === "grading") {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
        <Spinner aria-hidden="true" />
        {isSlow
          ? t("Still grading. This is taking longer than usual.")
          : t("Grading it with the exam's rubric. It can take up to 30 seconds.")}
      </p>
    );
  }

  const line = {
    failed: t("That didn't go through. Try again in a moment."),
    idle: t("It hasn't been graded yet."),
    limitReached: t("You've used today's essay grades. Try again tomorrow."),
  }[status];

  return (
    <>
      <StepDetail role={status === "idle" ? undefined : "alert"}>{line}</StepDetail>
      <Button onClick={() => void runner.gradeEssays()} size="sm" variant="outline">
        {t("Grade it")}
      </Button>
    </>
  );
}

/** An essay without a grade: left blank, too short to grade, or waiting for its grade. */
function UngradedEssayStep({ essay, eyebrow }: { essay: MockEssayView; eyebrow: string | null }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const writingName = useWritingName();
  const tooShort = essay.grade?.zeroReason === "tooShort";

  return (
    <StepCard>
      <StepHeader>
        {eyebrow && <StepEyebrow>{eyebrow}</StepEyebrow>}
        <StepTitle>{writingName(runner.view.essayRubric ?? "custom")}</StepTitle>
        {essay.status === "blank" && <StepDetail>{t("You left it blank.")}</StepDetail>}
        {tooShort && <StepDetail>{t("Too short to grade")}</StepDetail>}
      </StepHeader>
      {essay.status === "pending" && <PendingState />}
    </StepCard>
  );
}

/**
 * A full mock's essays after its score, one step each: its grade by the exam's rubric with each
 * criterion, then the one thing to work on; while it's being graded, that it's on its way. The
 * objective result never waits for it.
 */
export function useEssayItems(): StepsItem[] {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const { essayRubric, essays } = runner.view;

  return essays.flatMap((essay, index): StepsItem[] => {
    const eyebrow =
      essays.length > 1
        ? t("Written part · {number} of {total}", {
            number: String(index + 1),
            total: String(essays.length),
          })
        : essay.area;

    const id = `essay-${essay.itemId}`;
    const { grade } = essay;

    if (!grade || grade.zeroReason === "tooShort") {
      return [{ content: <UngradedEssayStep essay={essay} eyebrow={eyebrow} />, id }];
    }

    return [
      { content: <EssayGradeCard grade={grade} rubric={essayRubric ?? "custom"} />, id },
      { content: <NextStepComment grade={grade} />, id: `${id}-next` },
    ];
  });
}

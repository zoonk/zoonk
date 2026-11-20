"use client";

import { type MockEssayView } from "@zoonk/core/exams/mocks/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { useExtracted } from "next-intl";
import { Eyebrow } from "../_components/eyebrow";
import { StepCard, StepDetail, StepHeader, StepTitle } from "../_components/step-card";
import { type StepsItem } from "../_components/steps";
import { useWritingName } from "../essay/essay-labels";
import { WritingResultView } from "../writing/writing-result";
import { useMockScreen } from "./mock-context";

const SLOW_GRADING_MS = 30_000;

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

  return (
    <>
      <StepDetail role={status === "idle" ? undefined : "alert"}>
        {status === "idle"
          ? t("It hasn't been graded yet.")
          : t("That didn't go through. Try again in a moment.")}
      </StepDetail>
      <Button onClick={() => void runner.gradeEssays()} size="sm" variant="outline">
        {t("Grade it")}
      </Button>
    </>
  );
}

function UngradedEssayStep({ essay, eyebrow }: { essay: MockEssayView; eyebrow: string | null }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const writingName = useWritingName();

  return (
    <StepCard>
      <StepHeader>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <StepTitle>{writingName(runner.view.essayRubric ?? "custom")}</StepTitle>
        {essay.status === "blank" && <StepDetail>{t("You left it blank.")}</StepDetail>}
      </StepHeader>
      {essay.status === "pending" && <PendingState />}
    </StepCard>
  );
}

export function useEssayItems(): StepsItem[] {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const { essays } = runner.view;

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

    if (!grade || !essay.writing) {
      return [{ content: <UngradedEssayStep essay={essay} eyebrow={eyebrow} />, id }];
    }

    return [
      {
        content: (
          <WritingResultView
            eyebrow={eyebrow}
            grade={grade}
            prompt={essay.writing}
            text={essay.text ?? ""}
          />
        ),
        id,
      },
    ];
  });
}

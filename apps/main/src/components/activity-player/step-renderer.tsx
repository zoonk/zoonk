"use client";

import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { FillBlankStep } from "./fill-blank-step";
import { MatchColumnsStep } from "./match-columns-step";
import { MultipleChoiceStep } from "./multiple-choice-step";
import { type SelectedAnswer } from "./player-reducer";
import { SortOrderStep } from "./sort-order-step";
import { StaticStep } from "./static-step";
import { StaticTapZones, useSwipeNavigation } from "./static-step-navigation";
import { InteractiveStepLayout, StaticStepLayout } from "./step-layouts";
import { getMockAnswer, getStepSummary } from "./step-renderer-utils";

function PlaceholderInteractiveStep({
  onSelectAnswer,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const t = useExtracted();
  const summary = getStepSummary(step);
  const mockAnswer = getMockAnswer(step);
  const hasAnswer = selectedAnswer !== undefined;

  const handleClick = () => {
    if (mockAnswer) {
      onSelectAnswer(step.id, mockAnswer);
    }
  };

  return (
    <InteractiveStepLayout>
      <p className="text-muted-foreground text-center">{summary}</p>

      <Button disabled={hasAnswer || !mockAnswer} onClick={handleClick} variant="outline">
        {hasAnswer ? t("Answer selected") : t("Select answer")}
      </Button>
    </InteractiveStepLayout>
  );
}

export function StepRenderer({
  isFirst,
  onNavigateNext,
  onNavigatePrev,
  onSelectAnswer,
  selectedAnswer,
  step,
}: {
  isFirst: boolean;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const swipeHandlers = useSwipeNavigation({ onNavigateNext, onNavigatePrev });

  if (step.kind === "static") {
    return (
      <StaticStepLayout {...swipeHandlers}>
        <StaticStep step={step} />
        <StaticTapZones
          isFirst={isFirst}
          onNavigateNext={onNavigateNext}
          onNavigatePrev={onNavigatePrev}
        />
      </StaticStepLayout>
    );
  }

  if (step.kind === "multipleChoice") {
    return (
      <MultipleChoiceStep
        onSelectAnswer={onSelectAnswer}
        selectedAnswer={selectedAnswer}
        step={step}
      />
    );
  }

  if (step.kind === "fillBlank") {
    return (
      <FillBlankStep onSelectAnswer={onSelectAnswer} selectedAnswer={selectedAnswer} step={step} />
    );
  }

  if (step.kind === "matchColumns") {
    return (
      <MatchColumnsStep
        onSelectAnswer={onSelectAnswer}
        selectedAnswer={selectedAnswer}
        step={step}
      />
    );
  }

  if (step.kind === "sortOrder") {
    return (
      <SortOrderStep onSelectAnswer={onSelectAnswer} selectedAnswer={selectedAnswer} step={step} />
    );
  }

  return (
    <PlaceholderInteractiveStep
      onSelectAnswer={onSelectAnswer}
      selectedAnswer={selectedAnswer}
      step={step}
    />
  );
}

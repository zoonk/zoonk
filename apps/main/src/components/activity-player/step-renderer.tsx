"use client";

import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { CoachingOverlay } from "./coaching-overlay";
import { type SelectedAnswer } from "./player-reducer";
import { StaticStep } from "./static-step";
import { StaticEdgeChevrons, StaticTapZones, useSwipeNavigation } from "./static-step-navigation";
import { InteractiveStepLayout, StaticStepLayout } from "./step-layouts";
import { getMockAnswer, getStepSummary } from "./step-renderer-utils";

function PlaceholderInteractiveStep({
  onSelectAnswer,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer) => void;
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
  isLast,
  onNavigateNext,
  onNavigatePrev,
  onSelectAnswer,
  selectedAnswer,
  step,
}: {
  isFirst: boolean;
  isLast: boolean;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  onSelectAnswer: (stepId: string, answer: SelectedAnswer) => void;
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
          isLast={isLast}
          onNavigateNext={onNavigateNext}
          onNavigatePrev={onNavigatePrev}
        />
        <StaticEdgeChevrons isFirst={isFirst} isLast={isLast} />
        <CoachingOverlay />
      </StaticStepLayout>
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

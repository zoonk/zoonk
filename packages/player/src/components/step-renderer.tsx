"use client";

import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { FillBlankStep } from "./fill-blank-step";
import { ListeningStep } from "./listening-step";
import { MatchColumnsStep } from "./match-columns-step";
import { MultipleChoiceStep } from "./multiple-choice-step";
import { ReadingStep } from "./reading-step";
import { SelectImageStep } from "./select-image-step";
import { SortOrderStep } from "./sort-order-step";
import { StaticStep } from "./static-step";
import { StaticTapZones, useSwipeNavigation } from "./static-step-navigation";
import { StaticStepLayout } from "./step-layouts";
import { VocabularyStep } from "./vocabulary-step";

export function StepRenderer({
  isFirst,
  onNavigateNext,
  onNavigatePrev,
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: {
  isFirst: boolean;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const swipeHandlers = useSwipeNavigation({ onNavigateNext, onNavigatePrev });

  if (step.kind === "static") {
    const hasVisual = Boolean(step.visualKind && step.visualContent);

    return (
      <div className="relative flex w-full flex-1 justify-center" {...swipeHandlers}>
        <StaticStepLayout className={hasVisual ? "xl:justify-center xl:gap-4" : "justify-center"}>
          <StaticStep step={step} />
        </StaticStepLayout>

        <StaticTapZones
          isFirst={isFirst}
          onNavigateNext={onNavigateNext}
          onNavigatePrev={onNavigatePrev}
        />
      </div>
    );
  }

  if (step.kind === "multipleChoice") {
    return (
      <MultipleChoiceStep
        onSelectAnswer={onSelectAnswer}
        result={result}
        selectedAnswer={selectedAnswer}
        step={step}
      />
    );
  }

  if (step.kind === "fillBlank") {
    return (
      <FillBlankStep
        onSelectAnswer={onSelectAnswer}
        result={result}
        selectedAnswer={selectedAnswer}
        step={step}
      />
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

  if (step.kind === "selectImage") {
    return (
      <SelectImageStep
        onSelectAnswer={onSelectAnswer}
        result={result}
        selectedAnswer={selectedAnswer}
        step={step}
      />
    );
  }

  if (step.kind === "sortOrder") {
    return (
      <SortOrderStep
        onSelectAnswer={onSelectAnswer}
        result={result}
        selectedAnswer={selectedAnswer}
        step={step}
      />
    );
  }

  if (step.kind === "vocabulary") {
    return (
      <VocabularyStep
        onSelectAnswer={onSelectAnswer}
        result={result}
        selectedAnswer={selectedAnswer}
        step={step}
      />
    );
  }

  if (step.kind === "reading") {
    return (
      <ReadingStep
        onSelectAnswer={onSelectAnswer}
        result={result}
        selectedAnswer={selectedAnswer}
        step={step}
      />
    );
  }

  if (step.kind === "listening") {
    return (
      <ListeningStep
        onSelectAnswer={onSelectAnswer}
        result={result}
        selectedAnswer={selectedAnswer}
        step={step}
      />
    );
  }

  return null;
}

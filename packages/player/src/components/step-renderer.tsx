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
import { StepSideNav } from "./step-side-nav";
import { TranslationStep } from "./translation-step";
import { VisualStep } from "./visual-step";
import { VocabularyStep } from "./vocabulary-step";

export function StepRenderer({
  canNavigatePrev,
  onNavigateNext,
  onNavigatePrev,
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: {
  canNavigatePrev: boolean;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  if (step.kind === "static") {
    return (
      <div className="relative flex min-h-0 w-full max-w-5xl min-w-0 flex-1 justify-center">
        <StepSideNav
          canNavigatePrev={canNavigatePrev}
          onNavigateNext={onNavigateNext}
          onNavigatePrev={onNavigatePrev}
        />
        <StaticStep
          canNavigatePrev={canNavigatePrev}
          onNavigateNext={onNavigateNext}
          onNavigatePrev={onNavigatePrev}
          step={step}
        />
      </div>
    );
  }

  if (step.kind === "visual") {
    return (
      <div className="relative flex min-h-0 w-full max-w-5xl min-w-0 flex-1 justify-center">
        <StepSideNav
          canNavigatePrev={canNavigatePrev}
          onNavigateNext={onNavigateNext}
          onNavigatePrev={onNavigatePrev}
        />
        <VisualStep step={step} />
      </div>
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
      <div className="relative flex min-h-0 w-full max-w-5xl min-w-0 flex-1 justify-center">
        <StepSideNav
          canNavigatePrev={canNavigatePrev}
          onNavigateNext={onNavigateNext}
          onNavigatePrev={onNavigatePrev}
        />
        <VocabularyStep
          canNavigatePrev={canNavigatePrev}
          onNavigateNext={onNavigateNext}
          onNavigatePrev={onNavigatePrev}
          step={step}
        />
      </div>
    );
  }

  if (step.kind === "translation") {
    return (
      <TranslationStep
        onSelectAnswer={onSelectAnswer}
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

/* oxlint-disable max-lines-per-function, max-statements */
"use client";

import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { FillBlankStep } from "./fill-blank-step";
import { InvestigationStep } from "./investigation-step";
import { ListeningStep } from "./listening-step";
import { MatchColumnsStep } from "./match-columns-step";
import { MultipleChoiceStep } from "./multiple-choice-step";
import { ReadingStep } from "./reading-step";
import { SelectImageStep } from "./select-image-step";
import { SortOrderStep } from "./sort-order-step";
import { StaticStep } from "./static-step";
import { NavigableStepLayout } from "./step-layouts";
import { StepSideNav } from "./step-side-nav";
import { StoryStep } from "./story-step";
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
    const staticContent = parseStepContent("static", step.content);
    const isStoryStatic =
      staticContent.variant === "storyIntro" || staticContent.variant === "storyOutcome";

    if (isStoryStatic) {
      return <StaticStep step={step} />;
    }

    return (
      <NavigableStepLayout>
        <StepSideNav
          canNavigatePrev={canNavigatePrev}
          onNavigateNext={onNavigateNext}
          onNavigatePrev={onNavigatePrev}
        />
        <StaticStep step={step} />
      </NavigableStepLayout>
    );
  }

  if (step.kind === "visual") {
    return (
      <NavigableStepLayout>
        <StepSideNav
          canNavigatePrev={canNavigatePrev}
          onNavigateNext={onNavigateNext}
          onNavigatePrev={onNavigatePrev}
        />
        <VisualStep step={step} />
      </NavigableStepLayout>
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
      <NavigableStepLayout>
        <StepSideNav
          canNavigatePrev={canNavigatePrev}
          onNavigateNext={onNavigateNext}
          onNavigatePrev={onNavigatePrev}
        />
        <VocabularyStep step={step} />
      </NavigableStepLayout>
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

  if (step.kind === "story") {
    return (
      <StoryStep onSelectAnswer={onSelectAnswer} selectedAnswer={selectedAnswer} step={step} />
    );
  }

  if (step.kind === "investigation") {
    return (
      <InvestigationStep
        onSelectAnswer={onSelectAnswer}
        result={result}
        selectedAnswer={selectedAnswer}
        step={step}
      />
    );
  }

  return null;
}

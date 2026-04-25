/* oxlint-disable max-lines-per-function, max-statements */
"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { Fragment } from "react";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { type PlayerStepDescriptor, describePlayerStep, getPlayerStepImage } from "../player-step";
import {
  type PlayerRenderBehavior,
  getPlayerStepBehavior,
  hasStaticNavigation,
} from "../player-step-behavior";
import { FillBlankStep } from "./fill-blank-step";
import { InvestigationStep } from "./investigation-step";
import { ListeningStep } from "./listening-step";
import { MatchColumnsStep } from "./match-columns-step";
import { MultipleChoiceStep } from "./multiple-choice-step";
import { ReadingStep } from "./reading-step";
import { SelectImageStep } from "./select-image-step";
import { SortOrderStep } from "./sort-order-step";
import { StaticStep } from "./static-step";
import { StoryStep } from "./story-step";
import {
  type SwipeNavigableStepFrame,
  SwipeNavigableStepLayout,
} from "./swipe-navigable-step-layout";
import { TranslationStep } from "./translation-step";
import { VocabularyStep } from "./vocabulary-step";

type StepRendererProps = {
  canNavigatePrev: boolean;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer?: SelectedAnswer;
  step: SerializedStep;
};

function renderStepContent({
  render,
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: Pick<StepRendererProps, "onSelectAnswer" | "result" | "selectedAnswer" | "step"> & {
  render: PlayerRenderBehavior;
}) {
  switch (render) {
    case "fillBlank":
      return (
        <FillBlankStep
          onSelectAnswer={onSelectAnswer}
          result={result}
          selectedAnswer={selectedAnswer}
          step={step}
        />
      );
    case "investigation":
      return (
        <InvestigationStep
          onSelectAnswer={onSelectAnswer}
          result={result}
          selectedAnswer={selectedAnswer}
          step={step}
        />
      );
    case "listening":
      return (
        <ListeningStep
          onSelectAnswer={onSelectAnswer}
          result={result}
          selectedAnswer={selectedAnswer}
          step={step}
        />
      );
    case "matchColumns":
      return (
        <MatchColumnsStep
          onSelectAnswer={onSelectAnswer}
          selectedAnswer={selectedAnswer}
          step={step}
        />
      );
    case "multipleChoice":
      return (
        <MultipleChoiceStep
          onSelectAnswer={onSelectAnswer}
          selectedAnswer={selectedAnswer}
          step={step}
        />
      );
    case "reading":
      return (
        <ReadingStep
          onSelectAnswer={onSelectAnswer}
          result={result}
          selectedAnswer={selectedAnswer}
          step={step}
        />
      );
    case "selectImage":
      return (
        <SelectImageStep
          onSelectAnswer={onSelectAnswer}
          result={result}
          selectedAnswer={selectedAnswer}
          step={step}
        />
      );
    case "sortOrder":
      return (
        <SortOrderStep
          onSelectAnswer={onSelectAnswer}
          result={result}
          selectedAnswer={selectedAnswer}
          step={step}
        />
      );
    case "static":
      return <StaticStep step={step} />;
    case "story":
      return (
        <StoryStep onSelectAnswer={onSelectAnswer} selectedAnswer={selectedAnswer} step={step} />
      );
    case "translation":
      return (
        <TranslationStep
          onSelectAnswer={onSelectAnswer}
          selectedAnswer={selectedAnswer}
          step={step}
        />
      );
    case "vocabulary":
      return <VocabularyStep step={step} />;
    default:
      return null;
  }
}

/**
 * Static image steps render a full split media layout inside the navigable
 * swipe wrapper. They need the wrapper to stop applying the normal reading
 * max-width, while text-only static and vocabulary steps should keep it.
 */
function hasNavigableMediaFrame(descriptor: PlayerStepDescriptor) {
  return hasStaticNavigation(descriptor) && Boolean(getPlayerStepImage(descriptor));
}

/**
 * Converts the semantic step descriptor into the swipe wrapper frame. Keeping
 * this decision beside render routing avoids leaking static-step image details
 * into the lower-level gesture component.
 */
function getNavigableStepFrame(descriptor: PlayerStepDescriptor): SwipeNavigableStepFrame {
  if (hasNavigableMediaFrame(descriptor)) {
    return "media";
  }

  return "default";
}

export function StepRenderer({
  canNavigatePrev,
  onNavigateNext,
  onNavigatePrev,
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: StepRendererProps) {
  const descriptor = describePlayerStep(step);
  const behavior = getPlayerStepBehavior(descriptor);

  if (!descriptor || !behavior) {
    return null;
  }

  const content = renderStepContent({
    onSelectAnswer,
    render: behavior.render,
    result,
    selectedAnswer,
    step,
  });

  if (!content) {
    return null;
  }

  if (behavior.layout !== "navigable") {
    return <Fragment key={`step-${step.id}`}>{content}</Fragment>;
  }

  return (
    <SwipeNavigableStepLayout
      canNavigatePrev={canNavigatePrev}
      frame={getNavigableStepFrame(descriptor)}
      key={`step-${step.id}`}
      onNavigateNext={onNavigateNext}
      onNavigatePrev={onNavigatePrev}
    >
      {content}
    </SwipeNavigableStepLayout>
  );
}

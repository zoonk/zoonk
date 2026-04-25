"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { type SelectedAnswer } from "../player-reducer";
import { ChoiceStepLayout } from "./choice-step-layout";

function getSelectedOptionId(selectedAnswer?: SelectedAnswer): string | null {
  if (selectedAnswer?.kind !== "story") {
    return null;
  }

  return selectedAnswer.selectedOptionId;
}

export function StoryStep({
  onSelectAnswer,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  selectedAnswer?: SelectedAnswer;
  step: SerializedStep;
}) {
  const content = parseStepContent("story", step.content);
  const selectedOptionId = getSelectedOptionId(selectedAnswer);

  const handleSelect = (optionId: string) => {
    const option = content.options.find((item) => item.id === optionId);

    if (!option) {
      return;
    }

    if (selectedOptionId === option.id) {
      onSelectAnswer(step.id, null);
      return;
    }

    onSelectAnswer(step.id, {
      kind: "story",
      selectedOptionId: option.id,
    });
  };

  return (
    <ChoiceStepLayout
      context={content.problem}
      image={content.image}
      onSelect={handleSelect}
      options={content.options.map((option) => ({ key: option.id, text: option.text }))}
      selectedKey={selectedOptionId}
    />
  );
}

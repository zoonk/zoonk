"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { type SelectedAnswer } from "../player-reducer";
import { ChoiceStepLayout } from "./choice-step-layout";

function getSelectedOptionId(selectedAnswer?: SelectedAnswer): string | null {
  if (selectedAnswer?.kind !== "multipleChoice") {
    return null;
  }

  return selectedAnswer.selectedOptionId;
}

export function MultipleChoiceStep({
  onSelectAnswer,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  selectedAnswer?: SelectedAnswer;
  step: SerializedStep;
}) {
  const content = parseStepContent("multipleChoice", step.content);
  const selectedOptionId = getSelectedOptionId(selectedAnswer);

  const handleSelect = (optionId: string) => {
    if (selectedOptionId === optionId) {
      onSelectAnswer(step.id, null);
      return;
    }

    onSelectAnswer(step.id, { kind: "multipleChoice", selectedOptionId: optionId });
  };

  return (
    <ChoiceStepLayout
      context={content.context}
      image={content.image}
      onSelect={handleSelect}
      options={content.options.map((option) => ({ key: option.id, text: option.text }))}
      question={content.question}
      selectedKey={selectedOptionId}
    />
  );
}

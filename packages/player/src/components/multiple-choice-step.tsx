"use client";

import { parseStepContent } from "@zoonk/core/library/steps/contract";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type SelectedAnswer } from "../step-answer";
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
  onSelectAnswer: (answer: SelectedAnswer | null) => void;
  selectedAnswer?: SelectedAnswer;
  step: SerializedStep;
}) {
  const content = parseStepContent("multipleChoice", step.content);
  const selectedOptionId = getSelectedOptionId(selectedAnswer);

  const handleSelect = (optionId: string) => {
    if (selectedOptionId === optionId) {
      onSelectAnswer(null);
      return;
    }

    onSelectAnswer({ kind: "multipleChoice", selectedOptionId: optionId });
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

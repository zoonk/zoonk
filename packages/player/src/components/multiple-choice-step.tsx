"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { type SelectedAnswer } from "../player-reducer";
import { ChoiceStepLayout } from "./choice-step-layout";

function getSelectedIndex(selectedAnswer: SelectedAnswer | undefined): number | null {
  if (selectedAnswer?.kind !== "multipleChoice") {
    return null;
  }

  return selectedAnswer.selectedIndex;
}

export function MultipleChoiceStep({
  onSelectAnswer,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const content = parseStepContent("multipleChoice", step.content);
  const selectedIndex = getSelectedIndex(selectedAnswer);

  const handleSelect = (index: number) => {
    if (selectedIndex === index) {
      onSelectAnswer(step.id, null);
      return;
    }

    const selectedText = content.options[index]?.text ?? "";
    onSelectAnswer(step.id, {
      kind: "multipleChoice",
      selectedIndex: index,
      selectedText,
    });
  };

  return (
    <ChoiceStepLayout
      context={content.context}
      image={content.image}
      onSelect={handleSelect}
      options={content.options.map((option) => ({
        key: option.text,
        text: option.text,
      }))}
      question={content.question}
      selectedIndex={selectedIndex}
    />
  );
}

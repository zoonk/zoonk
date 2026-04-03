"use client";

import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { type SelectedAnswer } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { ChoiceStepLayout } from "./choice-step-layout";

function getSelectedIndex(
  selectedAnswer: SelectedAnswer | undefined,
  choices: { id: string }[],
): number | null {
  if (selectedAnswer?.kind !== "story") {
    return null;
  }

  const index = choices.findIndex((choice) => choice.id === selectedAnswer.selectedChoiceId);

  if (index === -1) {
    return null;
  }

  return index;
}

export function StoryStep({
  onSelectAnswer,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const content = parseStepContent("story", step.content);
  const selectedIndex = getSelectedIndex(selectedAnswer, content.choices);

  const handleSelect = (index: number) => {
    const choice = content.choices[index];

    if (!choice) {
      return;
    }

    if (selectedIndex === index) {
      onSelectAnswer(step.id, null);
      return;
    }

    onSelectAnswer(step.id, {
      kind: "story",
      selectedChoiceId: choice.id,
      selectedText: choice.text,
    });
  };

  return (
    <ChoiceStepLayout
      context={content.situation}
      onSelect={handleSelect}
      options={content.choices.map((choice) => ({ key: choice.id, text: choice.text }))}
      selectedIndex={selectedIndex}
    />
  );
}

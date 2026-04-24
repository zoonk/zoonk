"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { type SelectedAnswer } from "../player-reducer";
import { ChoiceStepLayout } from "./choice-step-layout";

function getSelectedIndex({
  choices,
  selectedAnswer,
}: {
  choices: { id: string }[];
  selectedAnswer?: SelectedAnswer;
}): number | null {
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
  selectedAnswer?: SelectedAnswer;
  step: SerializedStep;
}) {
  const content = parseStepContent("story", step.content);
  const selectedIndex = getSelectedIndex({ choices: content.choices, selectedAnswer });

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
      context={content.problem}
      image={content.image}
      onSelect={handleSelect}
      options={content.choices.map((choice) => ({ key: choice.id, text: choice.text }))}
      selectedIndex={selectedIndex}
    />
  );
}

"use client";

import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { type ActivityStepContent } from "@zoonk/core/library/activities/templates";
import {
  PlayerChoiceSceneOptionText,
  PlayerChoiceSceneOptions,
} from "../../components/player-choice-scene";
import { type ActivityPhase } from "../activity-renderer";
import { ActivityCheckQuestion } from "./activity-check-question";

type ChoiceCheck = Extract<ActivityStepContent["check"], { kind: "choice" }>;
type ChoiceOption = ChoiceCheck["options"][number];

function optionResult({
  isChecked,
  option,
  selectedId,
}: {
  isChecked: boolean;
  option: ChoiceOption;
  selectedId: string | null;
}): "correct" | "incorrect" | null {
  if (!isChecked) {
    return null;
  }

  if (option.isCorrect) {
    return "correct";
  }

  return option.id === selectedId ? "incorrect" : null;
}

/**
 * A question about what the learner saw on the canvas, answered with the player's option cards
 * (number keys pick an option). After the check, the right option and a wrong pick are marked.
 */
export function ActivityChoiceCheck({
  answer,
  check,
  onAnswerChange,
  phase,
}: {
  answer: ActivityAnswer | null;
  check: ChoiceCheck;
  onAnswerChange: (answer: ActivityAnswer | null) => void;
  phase: ActivityPhase;
}) {
  const selectedId = answer?.kind === "choice" ? answer.optionId : null;
  const isChecked = phase === "checked";

  function handleSelect(index: number) {
    const option = check.options[index];

    if (isChecked || !option) {
      return;
    }

    onAnswerChange(option.id === selectedId ? null : { kind: "choice", optionId: option.id });
  }

  return (
    <div className="flex flex-col gap-3" data-slot="activity-choice-check">
      <ActivityCheckQuestion>{check.question}</ActivityCheckQuestion>

      <PlayerChoiceSceneOptions
        ariaLabel={check.question}
        keyboardEnabled={!isChecked}
        onSelect={handleSelect}
        options={check.options.map((option) => ({
          content: <PlayerChoiceSceneOptionText>{option.text}</PlayerChoiceSceneOptionText>,
          disabled: isChecked,
          isDimmed: !isChecked && selectedId !== null && selectedId !== option.id,
          isSelected: selectedId === option.id,
          key: option.id,
          resultState: optionResult({ isChecked, option, selectedId }),
        }))}
      />
    </div>
  );
}

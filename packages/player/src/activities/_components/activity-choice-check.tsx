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
/**
 * A question about what the learner saw on the canvas, answered with the player's option cards
 * (number keys pick an option). After the check, only the right option and a wrong pick stay,
 * marked.
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

  return (
    <div className="flex flex-col gap-3" data-slot="activity-choice-check">
      <ActivityCheckQuestion>{check.question}</ActivityCheckQuestion>

      <PlayerChoiceSceneOptions
        ariaLabel={check.question}
        isChecked={isChecked}
        onSelect={(id) =>
          onAnswerChange(id === selectedId ? null : { kind: "choice", optionId: id })
        }
        options={check.options.map((option) => ({
          content: <PlayerChoiceSceneOptionText>{option.text}</PlayerChoiceSceneOptionText>,
          isCorrect: option.isCorrect,
          key: option.id,
        }))}
        selectedKey={selectedId}
      />
    </div>
  );
}

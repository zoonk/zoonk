"use client";

import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { type ActivityStepContent } from "@zoonk/core/library/activities/templates";
import { useSpokenText } from "@zoonk/learn/rich-text/speech";
import { cn } from "@zoonk/ui/lib/utils";
import {
  PlayerChoiceSceneOptionText,
  PlayerChoiceSceneOptions,
} from "../../components/player-choice-scene";
import { type ActivityPhase } from "../activity-renderer";
import { ActivityCheckQuestion } from "./activity-check-question";

type ChoiceCheck = Extract<ActivityStepContent["check"], { kind: "choice" }>;
export function ActivityChoiceCheck({
  answer,
  check,
  className,
  onAnswerChange,
  phase,
}: {
  answer: ActivityAnswer | null;
  className?: string;
  check: ChoiceCheck;
  onAnswerChange: (answer: ActivityAnswer | null) => void;
  phase: ActivityPhase;
}) {
  const spoken = useSpokenText();
  const selectedId = answer?.kind === "choice" ? answer.optionId : null;
  const isChecked = phase === "checked";

  return (
    <div className={cn("flex flex-col gap-3", className)} data-slot="activity-choice-check">
      <ActivityCheckQuestion>{check.question}</ActivityCheckQuestion>

      <PlayerChoiceSceneOptions
        ariaLabel={spoken.blocks(check.question)}
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

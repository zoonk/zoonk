"use client";

import { type CheckpointQuestion } from "@zoonk/core/checkpoints/contract";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { CheckIcon } from "lucide-react";
import { ANSWER_LETTERS, AnswerOption, AnswerOptionGroup } from "../_components/answer-option";
import { useTrueFalseLabels } from "../questions/use-true-false-labels";
import { useCheckpointScreen } from "./checkpoint-context";
import { type CheckpointAnswer } from "./checkpoint-duel-state";

type Verdict = { isCorrect: boolean } | null;

function isPicked({ answer, index }: { answer: CheckpointAnswer | null; index: number }) {
  if (!answer) {
    return false;
  }

  if ("selectedIndex" in answer) {
    return answer.selectedIndex === index;
  }

  return "isTrue" in answer && answer.isTrue === (index === 0);
}

function toAnswer({ format, index }: { format: CheckpointQuestion["format"]; index: number }) {
  return format === "trueFalse" ? { isTrue: index === 0 } : { selectedIndex: index };
}

/**
 * A checkpoint question's options with number-key shortcuts. After an answer the pick stays
 * marked, with a check when it was right; a wrong pick never reveals the right one until the end.
 */
export function CheckpointOptions({
  onSelect,
  question,
  selected,
  verdict,
}: {
  onSelect: (answer: CheckpointAnswer | null) => void;
  question: CheckpointQuestion;
  selected: CheckpointAnswer | null;
  verdict: Verdict;
}) {
  const { checkpoint } = useCheckpointScreen();
  const { answerLabel } = useTrueFalseLabels(checkpoint.trueFalseLabels);
  const isLocked = verdict !== null;

  const labels =
    question.format === "trueFalse"
      ? [answerLabel(true), answerLabel(false)]
      : (question.options ?? []);

  function pick(index: number): false | undefined {
    if (isLocked || index >= labels.length) {
      return false;
    }

    const answer = toAnswer({ format: question.format, index });
    onSelect(isPicked({ answer: selected, index }) ? null : answer);
    return undefined;
  }

  useNumberKeys({ count: labels.length, enabled: !isLocked, onPick: pick });

  return (
    <AnswerOptionGroup>
      {labels.map((label, index) => {
        const picked = isPicked({ answer: selected, index });
        const pickedRight = picked && verdict?.isCorrect === true;

        return (
          <AnswerOption
            disabled={isLocked}
            key={label}
            marker={pickedRight ? <CheckIcon /> : ANSWER_LETTERS[index]}
            onClick={() => pick(index)}
            picked={picked}
          >
            {label}
          </AnswerOption>
        );
      })}
    </AnswerOptionGroup>
  );
}

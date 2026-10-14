"use client";

import { type CheckpointQuestion } from "@zoonk/core/checkpoints/contract";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { AnswerOption, AnswerOptionGroup } from "../_components/answer-option";
import { ItemLine } from "../questions/item-text";
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

/** How the learner's pick turned out, once it has its verdict. */
function getPickResult(verdict: Verdict) {
  if (!verdict) {
    return null;
  }

  return verdict.isCorrect ? "right" : "wrong";
}

function toAnswer({ format, index }: { format: CheckpointQuestion["format"]; index: number }) {
  return format === "trueFalse" ? { isTrue: index === 0 } : { selectedIndex: index };
}

/**
 * A checkpoint question's options, numbered like a lesson's and picked with the same number keys.
 * They lock from Confirm (`locked`, while the answer is graded) through the verdict, so the pick on
 * screen is the one graded. After an answer the pick turns green or red ("Your answer"); a wrong
 * pick never reveals the right one until the end.
 */
export function CheckpointOptions({
  locked,
  onSelect,
  question,
  selected,
  verdict,
}: {
  /** The answer is on its way to be graded: the pick can't change. */
  locked: boolean;
  onSelect: (answer: CheckpointAnswer | null) => void;
  question: CheckpointQuestion;
  selected: CheckpointAnswer | null;
  verdict: Verdict;
}) {
  const { checkpoint } = useCheckpointScreen();
  const { answerLabel } = useTrueFalseLabels(checkpoint.trueFalseLabels);
  const isLocked = locked || verdict !== null;

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
        const result = picked ? getPickResult(verdict) : null;

        return (
          <AnswerOption
            aria-keyshortcuts={String(index + 1)}
            disabled={isLocked}
            key={label}
            marker={index + 1}
            onClick={() => pick(index)}
            picked={picked}
            result={result}
          >
            <ItemLine text={label} />
          </AnswerOption>
        );
      })}
    </AnswerOptionGroup>
  );
}

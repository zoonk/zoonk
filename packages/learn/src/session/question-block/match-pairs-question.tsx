"use client";

import { useRef } from "react";
import { MatchBoard } from "../../_components/match-board";
import { MatchEntry } from "../../_components/match-entry";
import { useFocusMainActionWhenComplete } from "../../_components/question-actions";
import {
  type MatchBoardAnswer,
  type MatchSide,
  useMatchBoard,
} from "../../_components/use-match-board";
import { ItemLine } from "../../questions/item-text";
import { useSpokenText } from "../../rich-text/use-spoken-text";

/**
 * With `answerKey` (a learning question) each pair is checked as it's made and the last one sends
 * the answer through `onSubmit`, wrong tries included; without it (a test) the host gets the pairs
 * once all are made, null before, and grades them on Check. In a result the pairs the learner
 * missed first are marked; `revealed` is the answer to a board the learner didn't finish ("I don't
 * know yet").
 */
export function MatchPairsQuestion({
  answerKey,
  disabled,
  graded,
  left,
  onChange,
  onSubmit,
  revealed,
  right,
}: {
  answerKey?: readonly number[] | null;
  disabled: boolean;
  graded: boolean;
  left: readonly string[];
  onChange: (answer: MatchBoardAnswer | { matches: number[] } | null) => void;
  onSubmit: (answer: MatchBoardAnswer) => void;
  revealed: readonly number[] | null;
  right: readonly string[];
}) {
  const spoken = useSpokenText();
  const listRef = useRef<HTMLDivElement>(null);
  const text = (side: MatchSide, index: number) => (side === "left" ? left : right)[index] ?? "";

  const board = useMatchBoard({
    disabled,
    isPair: answerKey ? (attempt) => answerKey[attempt.left] === attempt.right : undefined,
    leftCount: left.length,
    onChange: (matches) => onChange(matches ? { matches } : null),
    onComplete: (answer) => {
      onChange(answer);
      onSubmit(answer);
    },
    reveal: answerKey ? revealed : null,
    rightCount: right.length,
    say: (side, index) => spoken.inline(text(side, index)),
    showMisses: graded,
  });

  useFocusMainActionWhenComplete({ complete: board.complete, containerRef: listRef });

  return (
    <div ref={listRef}>
      <MatchBoard
        leftCount={left.length}
        renderCard={(side, index) => (
          <MatchEntry {...board.entry(side, index)}>
            <ItemLine text={text(side, index)} />
          </MatchEntry>
        )}
        rightCount={right.length}
        solved={board.solved}
      />
      <p aria-live="polite" className="sr-only">
        {board.announcement}
      </p>
    </div>
  );
}

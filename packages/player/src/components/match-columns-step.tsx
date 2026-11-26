"use client";

import { parseStepContent } from "@zoonk/core/library/steps/contract";
import { checkSingleMatchPair } from "@zoonk/core/player/contracts/check-answer";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { MatchBoard } from "@zoonk/learn/match-board";
import { MatchEntry } from "@zoonk/learn/match-entry";
import { MatchMisses } from "@zoonk/learn/match-misses";
import { useMatchBoard } from "@zoonk/learn/use-match-board";
import { stripWrappingQuotes } from "@zoonk/utils/string";
import { useExtracted } from "next-intl";
import { use, useId, useMemo } from "react";
import { ActivityCanvas } from "../activities/_components/activity-canvas";
import { BoardMissesContext } from "../lesson/feedback/board-misses";
import { useCheckWhenAnswered } from "../lesson/use-check-when-answered";
import { usePlayerInteractionState } from "../player-context";
import { type SelectedAnswer } from "../step-answer";
import { QuestionText } from "./question-text";
import { InteractiveStepLayout } from "./step-layouts";

type Pair = { left: string; right: string };

/** A finished board's pairs, by each card's place in its column. */
function placesOf({
  left,
  pairs,
  right,
}: {
  left: readonly string[];
  pairs: readonly Pair[];
  right: readonly string[];
}): number[] {
  return left.map((text) => right.indexOf(pairs.find((pair) => pair.left === text)?.right ?? ""));
}

export function MatchColumnsStep({
  onSelectAnswer,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (answer: SelectedAnswer | null) => void;
  selectedAnswer?: SelectedAnswer;
  step: SerializedStep;
}) {
  const content = useMemo(() => parseStepContent("matchColumns", step.content), [step.content]);
  const t = useExtracted();
  const questionId = useId();
  const interactionState = usePlayerInteractionState();
  const answered = selectedAnswer?.kind === "matchColumns" ? selectedAnswer : null;
  const checkWhenAnswered = useCheckWhenAnswered(answered !== null);
  const showMisses = use(BoardMissesContext);
  const left = content.pairs.map((pair) => pair.left);
  const right = step.matchColumnsRightItems;

  const text = (side: "left" | "right", index: number) =>
    (side === "left" ? left : right)[index] ?? "";

  const cardText = (side: "left" | "right", index: number) =>
    stripWrappingQuotes(text(side, index));

  const board = useMatchBoard({
    disabled: answered !== null,
    finished: answered ? placesOf({ left, pairs: answered.userPairs, right }) : undefined,
    isPair: (attempt) =>
      checkSingleMatchPair(content, {
        left: text("left", attempt.left),
        right: text("right", attempt.right),
      }),
    keys: interactionState !== "paused",
    leftCount: left.length,
    onComplete: ({ matches, misses }) => {
      showMisses?.(<MatchMisses misses={misses} renderCard={cardText} />);
      checkWhenAnswered();

      onSelectAnswer({
        kind: "matchColumns",
        mistakes: misses.length,
        userPairs: matches.map((place, index) => ({
          left: text("left", index),
          right: text("right", place),
        })),
      });
    },
    rightCount: right.length,
    say: cardText,
  });

  return (
    <InteractiveStepLayout>
      <div id={questionId}>
        <QuestionText>{content.question ?? t("Match the pairs.")}</QuestionText>
      </div>

      <ActivityCanvas labelId={questionId}>
        <MatchBoard
          leftCount={left.length}
          renderCard={(side, index) => (
            <MatchEntry {...board.entry(side, index)}>{cardText(side, index)}</MatchEntry>
          )}
          rightCount={right.length}
          solved={board.solved}
        />
      </ActivityCanvas>

      <p aria-live="polite" className="sr-only">
        {board.announcement}
      </p>
    </InteractiveStepLayout>
  );
}

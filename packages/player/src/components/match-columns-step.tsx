"use client";

import { parseStepContent } from "@zoonk/core/library/steps/contract";
import { checkSingleMatchPair } from "@zoonk/core/player/contracts/check-answer";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { MatchEntry } from "@zoonk/learn/match-entry";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { MAX_PICK_KEYS } from "@zoonk/ui/lib/shortcuts";
import { stripWrappingQuotes } from "@zoonk/utils/string";
import { useExtracted } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";
import { useWebHaptics } from "web-haptics/react";
import { usePlayerInteractionState } from "../player-context";
import { type SelectedAnswer } from "../step-answer";
import {
  type MatchAttempt,
  type MatchItemData,
  type MatchSelection,
  type MatchSide,
  buildLeftMatchItems,
  buildMatchAttempt,
  buildRightMatchItems,
  buildSolvedMatchBoard,
  getActiveKeyboardSide,
  getEntryState,
  getKeyboardItems,
  getPairIndex,
  isItemMatched,
  restoreMatches,
} from "./_utils/match-columns";
import { MatchBoard } from "./match-board";
import { QuestionText } from "./question-text";
import { InteractiveStepLayout } from "./step-layouts";

const FLASH_DURATION = 800;

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
  const interactionState = usePlayerInteractionState();
  const { trigger } = useWebHaptics();

  const leftItems = useMemo(() => buildLeftMatchItems(content.pairs), [content.pairs]);

  const rightItems = useMemo(
    () => buildRightMatchItems(step.matchColumnsRightItems),
    [step.matchColumnsRightItems],
  );

  const [selected, setSelected] = useState<MatchSelection | null>(null);

  const [correctMatches, setCorrectMatches] = useState<MatchAttempt[]>(() =>
    selectedAnswer?.kind === "matchColumns"
      ? restoreMatches({ leftItems, pairs: selectedAnswer.userPairs, rightItems })
      : [],
  );

  const [flashingMatch, setFlashingMatch] = useState<MatchAttempt | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allMatched = correctMatches.length === content.pairs.length;
  const isSolved = allMatched || selectedAnswer?.kind === "matchColumns";

  const board = isSolved
    ? buildSolvedMatchBoard(content.pairs)
    : { matches: correctMatches, rightItems };

  const activeKeyboardSide = getActiveKeyboardSide(selected);
  const keyboardItems = getKeyboardItems({ activeKeyboardSide, leftItems, rightItems });

  const handleTap = useCallback(
    (item: MatchItemData) => {
      if (isItemMatched({ correctMatches, item })) {
        return;
      }

      if (flashingMatch) {
        return;
      }

      if (!selected) {
        setSelected(item);
        return;
      }

      if (selected.side === item.side) {
        setSelected(selected.id === item.id ? null : item);
        return;
      }

      const match = buildMatchAttempt({ current: item, selected });

      const isCorrectPair = checkSingleMatchPair(content, match.pair);

      if (isCorrectPair) {
        const nextCorrect = [...correctMatches, match];
        void trigger("light");
        setCorrectMatches(nextCorrect);
        setSelected(null);

        if (nextCorrect.length === content.pairs.length) {
          onSelectAnswer({
            kind: "matchColumns",
            mistakes,
            userPairs: nextCorrect.map((attempt) => attempt.pair),
          });
        }
      } else {
        void trigger("warning");
        setMistakes((prev) => prev + 1);
        setFlashingMatch(match);
        setSelected(null);

        if (flashTimeoutRef.current) {
          clearTimeout(flashTimeoutRef.current);
        }

        flashTimeoutRef.current = setTimeout(() => {
          setFlashingMatch(null);
          flashTimeoutRef.current = null;
        }, FLASH_DURATION);
      }
    },
    [content, correctMatches, flashingMatch, mistakes, onSelectAnswer, selected, trigger],
  );

  useNumberKeys({
    count: Math.min(keyboardItems.length, MAX_PICK_KEYS),
    enabled: !isSolved && flashingMatch === null && interactionState !== "paused",
    onPick: (index) => {
      const item = keyboardItems[index];

      if (item) {
        handleTap(item);
      }
    },
  });

  const question = content.question ?? t("Match the pairs.");

  const solvedRows = leftItems.map((item, index) => ({
    left: item,
    right: board.rightItems[index] ?? null,
  }));

  function renderItem(side: MatchSide, item: MatchItemData, index: number) {
    const state = getEntryState({ correctMatches: board.matches, flashingMatch, item, selected });

    return (
      <MatchEntry
        disabled={state === "wrong"}
        index={index}
        keyActive={activeKeyboardSide === side}
        onClick={() => handleTap(item)}
        pair={getPairIndex({ correctMatches: board.matches, item, leftItems })}
        state={state}
      >
        {stripWrappingQuotes(item.label)}
      </MatchEntry>
    );
  }

  return (
    <InteractiveStepLayout>
      <QuestionText>{question}</QuestionText>

      <MatchBoard
        alignRows
        className="text-reading"
        left={leftItems}
        renderItem={renderItem}
        right={board.rightItems}
        solvedRows={isSolved ? solvedRows : undefined}
      />

      <div aria-live="polite" className="sr-only" role="status">
        {allMatched && t("All pairs matched. Press Check to continue.")}
      </div>
    </InteractiveStepLayout>
  );
}

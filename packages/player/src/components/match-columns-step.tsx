"use client";

import { checkSingleMatchPair } from "@zoonk/core/player/contracts/check-answer";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { useWebHaptics } from "web-haptics/react";
import { type SelectedAnswer } from "../player-reducer";
import { MAX_NUMBER_KEY_SHORTCUT, getNumberKeyShortcut } from "../player-shortcuts";
import { useOptionKeyboard } from "../use-option-keyboard";
import {
  type ItemVisualState,
  type MatchAttempt,
  type MatchItemData,
  type MatchSelection,
  type MatchSide,
  buildLeftMatchItems,
  buildMatchAttempt,
  buildRightMatchItems,
  getActiveKeyboardSide,
  getItemClassName,
  getItemVisualState,
  getKeyboardItems,
  isItemMatched,
} from "./_utils/match-columns";
import { stripWrappingQuotes } from "./_utils/strip-wrapping-quotes";
import { QuestionText } from "./question-text";
import { ResultKbd } from "./result-kbd";
import { InteractiveStepLayout } from "./step-layouts";

const FLASH_DURATION = 800;

function MatchItem({
  isShortcutActive,
  label,
  onTap,
  shortcut,
  state,
}: {
  isShortcutActive: boolean;
  label: string;
  onTap: () => void;
  shortcut: string | null;
  state: ItemVisualState;
}) {
  const isLocked = state === "correct" || state === "incorrectFlash";
  const displayLabel = stripWrappingQuotes(label);
  const visibleShortcut = !isLocked && isShortcutActive ? shortcut : null;

  return (
    <button
      aria-label={displayLabel}
      aria-keyshortcuts={visibleShortcut ?? undefined}
      aria-pressed={state === "selected"}
      className={cn(
        "border-border flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-2.5 text-left text-sm wrap-break-word transition-all duration-150 sm:px-4 sm:py-3.5 sm:text-base",
        getItemClassName(state),
      )}
      aria-disabled={isLocked || undefined}
      disabled={isLocked}
      onClick={onTap}
      type="button"
    >
      {shortcut && (
        <ResultKbd
          className={cn(
            "hidden shrink-0 lg:pointer-fine:inline-flex",
            !visibleShortcut && "invisible",
          )}
          isSelected={state === "selected"}
        >
          {shortcut}
        </ResultKbd>
      )}

      <span className="min-w-0">{displayLabel}</span>
    </button>
  );
}

function MatchGrid({
  activeKeyboardSide,
  correctMatches,
  flashingMatch,
  leftItems,
  onTap,
  rightItems,
  selected,
}: {
  activeKeyboardSide: MatchSide;
  correctMatches: MatchAttempt[];
  flashingMatch: MatchAttempt | null;
  leftItems: MatchItemData[];
  onTap: (item: MatchItemData) => void;
  rightItems: MatchItemData[];
  selected: MatchSelection | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      {leftItems.map((left, index) => {
        const right = rightItems[index];

        if (!right) {
          return null;
        }

        const leftState = getItemVisualState({
          correctMatches,
          flashingMatch,
          item: left,
          selected,
        });

        const rightState = getItemVisualState({
          correctMatches,
          flashingMatch,
          item: right,
          selected,
        });

        return (
          <Fragment key={left.id}>
            <MatchItem
              isShortcutActive={activeKeyboardSide === "left"}
              label={left.label}
              onTap={() => onTap(left)}
              shortcut={getNumberKeyShortcut(index)}
              state={leftState}
            />

            <MatchItem
              isShortcutActive={activeKeyboardSide === "right"}
              label={right.label}
              onTap={() => onTap(right)}
              shortcut={getNumberKeyShortcut(index)}
              state={rightState}
            />
          </Fragment>
        );
      })}
    </div>
  );
}

export function MatchColumnsStep({
  onSelectAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  selectedAnswer?: SelectedAnswer;
  step: SerializedStep;
}) {
  const content = useMemo(() => parseStepContent("matchColumns", step.content), [step.content]);
  const t = useExtracted();
  const { trigger } = useWebHaptics();

  const leftItems = useMemo(() => buildLeftMatchItems(content.pairs), [content.pairs]);

  const rightItems = useMemo(
    () => buildRightMatchItems(step.matchColumnsRightItems),
    [step.matchColumnsRightItems],
  );

  const [selected, setSelected] = useState<MatchSelection | null>(null);
  const [correctMatches, setCorrectMatches] = useState<MatchAttempt[]>([]);
  const [flashingMatch, setFlashingMatch] = useState<MatchAttempt | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allMatched = correctMatches.length === content.pairs.length;
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
          onSelectAnswer(step.id, {
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
    [content, correctMatches, flashingMatch, mistakes, onSelectAnswer, selected, step.id, trigger],
  );

  useOptionKeyboard({
    enabled: !allMatched && flashingMatch === null,
    onSelect: (index) => {
      const item = keyboardItems[index];

      if (item) {
        handleTap(item);
      }
    },
    optionCount: Math.min(keyboardItems.length, MAX_NUMBER_KEY_SHORTCUT),
  });

  const question = content.question ?? t("Match the pairs.");

  return (
    <InteractiveStepLayout>
      <QuestionText>{question}</QuestionText>

      <MatchGrid
        activeKeyboardSide={activeKeyboardSide}
        correctMatches={correctMatches}
        flashingMatch={flashingMatch}
        leftItems={leftItems}
        onTap={handleTap}
        rightItems={rightItems}
        selected={selected}
      />

      <div aria-live="polite" className="sr-only" role="status">
        {allMatched && t("All pairs matched. Press Check to continue.")}
      </div>
    </InteractiveStepLayout>
  );
}

"use client";

import { parseStepContent } from "@zoonk/core/library/steps/contract";
import { checkSingleMatchPair } from "@zoonk/core/player/contracts/check-answer";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { Kbd } from "@zoonk/ui/components/kbd";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { useWebHaptics } from "web-haptics/react";
import { usePlayerInteractionState } from "../player-context";
import { MAX_NUMBER_KEY_SHORTCUT, getNumberKeyShortcut } from "../player-shortcuts";
import { type SelectedAnswer } from "../step-answer";
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
import { InteractiveStepLayout } from "./step-layouts";

const FLASH_DURATION = 800;

/**
 * One item to match, drawn like an answer option: its number in a keycap (number keys pick from
 * one column at a time), its words, and a strong line that turns into a firm ring when picked,
 * blue once matched and red for a moment on a wrong pair.
 */
function MatchItem({
  isShortcutActive,
  label,
  marker,
  onTap,
  state,
}: {
  isShortcutActive: boolean;
  label: string;
  marker: number;
  onTap: () => void;
  state: ItemVisualState;
}) {
  const isLocked = state === "correct" || state === "incorrectFlash";
  const displayLabel = stripWrappingQuotes(label);
  const shortcut = !isLocked && isShortcutActive ? getNumberKeyShortcut(marker - 1) : null;

  return (
    <button
      aria-keyshortcuts={shortcut ?? undefined}
      aria-pressed={state === "selected"}
      className={cn(
        "rounded-option focus-visible:outline-ring flex min-h-11 items-start gap-3 px-3 py-3.25 text-left text-[0.9375rem] leading-6 font-medium wrap-break-word transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid sm:px-3.5",
        getItemClassName(state),
      )}
      aria-disabled={isLocked || undefined}
      disabled={isLocked}
      onClick={onTap}
      type="button"
    >
      {/* On the label's first line when a long label wraps. */}
      <LineMarker aria-hidden="true">
        <Kbd>{marker}</Kbd>
      </LineMarker>

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
    <div className="grid grid-cols-2 gap-2.5">
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
              marker={index + 1}
              onTap={() => onTap(left)}
              state={leftState}
            />

            <MatchItem
              isShortcutActive={activeKeyboardSide === "right"}
              label={right.label}
              marker={index + 1}
              onTap={() => onTap(right)}
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
    count: Math.min(keyboardItems.length, MAX_NUMBER_KEY_SHORTCUT),
    enabled: !allMatched && flashingMatch === null && interactionState !== "paused",
    onPick: (index) => {
      const item = keyboardItems[index];

      if (item) {
        handleTap(item);
      }
    },
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

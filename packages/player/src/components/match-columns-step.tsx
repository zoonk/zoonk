"use client";

import { checkSingleMatchPair } from "@zoonk/core/player/contracts/check-answer";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { useWebHaptics } from "web-haptics/react";
import { type SelectedAnswer } from "../player-reducer";
import { stripWrappingQuotes } from "./_utils/strip-wrapping-quotes";
import { QuestionText } from "./question-text";
import { InteractiveStepLayout } from "./step-layouts";

type Pair = { left: string; right: string };
type ItemVisualState = "correct" | "idle" | "incorrectFlash" | "selected";
type MatchSide = "left" | "right";

const FLASH_DURATION = 800;

type MatchItemData = { id: string; label: string; side: MatchSide };
type MatchSelection = MatchItemData;
type MatchAttempt = { leftId: string; pair: Pair; rightId: string };

/**
 * Match-column content only stores display labels, and duplicate labels are valid authored content.
 * The player still needs one identity per visible button so solving one duplicate does not lock every
 * other button with the same text.
 */
function buildLeftMatchItems(pairs: Pair[]): MatchItemData[] {
  return pairs.map((pair, index) => ({ id: `left:${index}`, label: pair.left, side: "left" }));
}

/**
 * Right-side labels are already shuffled before they reach the component, so their rendered order is
 * the only stable identity available. That is enough because equal labels are interchangeable for
 * answer checking, but each visible button must still be selectable exactly once.
 */
function buildRightMatchItems(labels: string[]): MatchItemData[] {
  return labels.map((label, index) => ({ id: `right:${index}`, label, side: "right" }));
}

/**
 * Correct and flashing states belong to a clicked visual item, not every item with the same label.
 * This keeps duplicate labels independent while preserving the label-only answer contract.
 */
function getAttemptItemId({ attempt, side }: { attempt: MatchAttempt; side: MatchSide }): string {
  return side === "left" ? attempt.leftId : attempt.rightId;
}

/**
 * The answer contract still uses labels, so the pair sent to shared checking is built from the two
 * selected buttons while the local ids remember which rendered buttons should become locked.
 */
function buildMatchAttempt({
  current,
  selected,
}: {
  current: MatchSelection;
  selected: MatchSelection;
}): MatchAttempt {
  if (current.side === "left") {
    return {
      leftId: current.id,
      pair: { left: current.label, right: selected.label },
      rightId: selected.id,
    };
  }

  return {
    leftId: selected.id,
    pair: { left: selected.label, right: current.label },
    rightId: current.id,
  };
}

/**
 * A visible button is matched when its local id was used in a successful pair. Labels are intentionally
 * ignored here because duplicate labels need independent state.
 */
function isItemMatched({
  correctMatches,
  item,
}: {
  correctMatches: MatchAttempt[];
  item: MatchItemData;
}): boolean {
  return correctMatches.some(
    (match) => getAttemptItemId({ attempt: match, side: item.side }) === item.id,
  );
}

function getItemVisualState({
  correctMatches,
  flashingMatch,
  item,
  selected,
}: {
  correctMatches: MatchAttempt[];
  flashingMatch: MatchAttempt | null;
  item: MatchItemData;
  selected: MatchSelection | null;
}): ItemVisualState {
  if (isItemMatched({ correctMatches, item })) {
    return "correct";
  }

  if (flashingMatch && getAttemptItemId({ attempt: flashingMatch, side: item.side }) === item.id) {
    return "incorrectFlash";
  }

  if (selected && selected.id === item.id) {
    return "selected";
  }

  return "idle";
}

function getItemClassName(state: ItemVisualState): string {
  if (state === "correct") {
    return "bg-success/5 border-transparent text-success opacity-75 pointer-events-none";
  }

  if (state === "incorrectFlash") {
    return "border-destructive bg-destructive/5 animate-shake";
  }

  if (state === "selected") {
    return "border-primary bg-primary/5";
  }

  return "hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]";
}

function MatchItem({
  label,
  onTap,
  state,
}: {
  label: string;
  onTap: () => void;
  state: ItemVisualState;
}) {
  const isLocked = state === "correct" || state === "incorrectFlash";
  const displayLabel = stripWrappingQuotes(label);

  return (
    <button
      aria-label={displayLabel}
      aria-pressed={state === "selected"}
      className={cn(
        "border-border flex min-h-11 items-center rounded-lg border px-2.5 py-2.5 text-left text-sm wrap-break-word transition-all duration-150 sm:px-4 sm:py-3.5 sm:text-base",
        getItemClassName(state),
      )}
      aria-disabled={isLocked || undefined}
      disabled={isLocked}
      onClick={onTap}
      type="button"
    >
      <span>{displayLabel}</span>
    </button>
  );
}

function MatchGrid({
  correctMatches,
  flashingMatch,
  leftItems,
  onTap,
  rightItems,
  selected,
}: {
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
            <MatchItem label={left.label} onTap={() => onTap(left)} state={leftState} />
            <MatchItem label={right.label} onTap={() => onTap(right)} state={rightState} />
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

  const allMatched = correctMatches.length === content.pairs.length;
  const question = content.question ?? t("Match the pairs.");

  return (
    <InteractiveStepLayout>
      <QuestionText>{question}</QuestionText>

      <MatchGrid
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

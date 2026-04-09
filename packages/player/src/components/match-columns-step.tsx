"use client";

import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { useWebHaptics } from "web-haptics/react";
import { checkSingleMatchPair } from "../check-answer";
import { type SelectedAnswer } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { useReplaceName } from "../user-name-context";
import { QuestionText } from "./question-text";
import { InteractiveStepLayout } from "./step-layouts";

type Pair = { left: string; right: string };
type ItemVisualState = "correct" | "idle" | "incorrectFlash" | "selected";

const FLASH_DURATION = 800;

type Selection = { item: string; side: "left" | "right" };

function getItemVisualState({
  correctPairs,
  flashingPair,
  item,
  selected,
  side,
}: {
  correctPairs: Pair[];
  flashingPair: Pair | null;
  item: string;
  selected: Selection | null;
  side: "left" | "right";
}): ItemVisualState {
  if (correctPairs.some((pair) => pair[side] === item)) {
    return "correct";
  }

  if (flashingPair && flashingPair[side] === item) {
    return "incorrectFlash";
  }

  if (selected && selected.side === side && selected.item === item) {
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

  return (
    <button
      aria-label={label}
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
      <span>{label}</span>
    </button>
  );
}

function MatchGrid({
  correctPairs,
  flashingPair,
  leftItems,
  onTap,
  rightItems,
  selected,
}: {
  correctPairs: Pair[];
  flashingPair: Pair | null;
  leftItems: string[];
  onTap: (side: "left" | "right", item: string) => void;
  rightItems: string[];
  selected: Selection | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      {leftItems.map((left, index) => {
        const right = rightItems[index];
        if (!right) {
          return null;
        }

        const leftState = getItemVisualState({
          correctPairs,
          flashingPair,
          item: left,
          selected,
          side: "left",
        });

        const rightState = getItemVisualState({
          correctPairs,
          flashingPair,
          item: right,
          selected,
          side: "right",
        });

        return (
          <Fragment key={left}>
            <MatchItem label={left} onTap={() => onTap("left", left)} state={leftState} />
            <MatchItem label={right} onTap={() => onTap("right", right)} state={rightState} />
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
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const content = useMemo(() => parseStepContent("matchColumns", step.content), [step.content]);
  const replaceName = useReplaceName();
  const t = useExtracted();
  const { trigger } = useWebHaptics();

  const leftItems = useMemo(() => content.pairs.map((pair) => pair.left), [content.pairs]);

  const [selected, setSelected] = useState<Selection | null>(null);
  const [correctPairs, setCorrectPairs] = useState<Pair[]>([]);
  const [flashingPair, setFlashingPair] = useState<Pair | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTap = useCallback(
    (side: "left" | "right", item: string) => {
      if (correctPairs.some((pair) => pair[side] === item)) {
        return;
      }

      if (flashingPair) {
        return;
      }

      if (!selected) {
        setSelected({ item, side });
        return;
      }

      if (selected.side === side) {
        setSelected(selected.item === item ? null : { item, side });
        return;
      }

      const pair: Pair =
        side === "left"
          ? { left: item, right: selected.item }
          : { left: selected.item, right: item };

      const isCorrectPair = checkSingleMatchPair(content, pair);

      if (isCorrectPair) {
        const nextCorrect = [...correctPairs, pair];
        void trigger("light");
        setCorrectPairs(nextCorrect);
        setSelected(null);

        if (nextCorrect.length === content.pairs.length) {
          onSelectAnswer(step.id, {
            kind: "matchColumns",
            mistakes,
            userPairs: nextCorrect,
          });
        }
      } else {
        void trigger("warning");
        setMistakes((prev) => prev + 1);
        setFlashingPair(pair);
        setSelected(null);

        if (flashTimeoutRef.current) {
          clearTimeout(flashTimeoutRef.current);
        }

        flashTimeoutRef.current = setTimeout(() => {
          setFlashingPair(null);
          flashTimeoutRef.current = null;
        }, FLASH_DURATION);
      }
    },
    [content, correctPairs, flashingPair, mistakes, onSelectAnswer, selected, step.id, trigger],
  );

  const allMatched = correctPairs.length === content.pairs.length;

  return (
    <InteractiveStepLayout>
      {content.question && <QuestionText>{replaceName(content.question)}</QuestionText>}

      <MatchGrid
        correctPairs={correctPairs}
        flashingPair={flashingPair}
        leftItems={leftItems}
        onTap={handleTap}
        rightItems={step.matchColumnsRightItems}
        selected={selected}
      />

      <div aria-live="polite" className="sr-only" role="status">
        {allMatched && t("All pairs matched. Press Check to continue.")}
      </div>
    </InteractiveStepLayout>
  );
}

"use client";

import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { checkSingleMatchPair } from "@zoonk/core/player/check-answer";
import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { shuffle } from "@zoonk/utils/shuffle";
import { CircleCheck } from "lucide-react";
import { useExtracted } from "next-intl";
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { type SelectedAnswer } from "./player-reducer";
import { QuestionText } from "./question-text";
import { InteractiveStepLayout } from "./step-layouts";
import { useReplaceName } from "./user-name-context";

type Pair = { left: string; right: string };
type ItemVisualState = "correct" | "idle" | "incorrectFlash" | "selected";

const FLASH_DURATION = 800;

function getItemVisualState({
  correctPairs,
  flashingPair,
  item,
  selectedLeft,
  side,
}: {
  correctPairs: Pair[];
  flashingPair: Pair | null;
  item: string;
  selectedLeft: string | null;
  side: "left" | "right";
}): ItemVisualState {
  if (correctPairs.some((pair) => pair[side] === item)) {
    return "correct";
  }

  if (flashingPair && flashingPair[side] === item) {
    return "incorrectFlash";
  }

  if (side === "left" && selectedLeft === item) {
    return "selected";
  }

  return "idle";
}

function getItemClassName(state: ItemVisualState): string {
  if (state === "correct") {
    return "border-success bg-success/5 pointer-events-none";
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
        "border-border flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-2.5 text-left text-sm break-words transition-all duration-150 sm:px-4 sm:py-3.5 sm:text-base",
        getItemClassName(state),
      )}
      disabled={isLocked}
      onClick={onTap}
      type="button"
    >
      {state === "correct" && (
        <CircleCheck aria-hidden="true" className="text-success size-3.5 shrink-0" />
      )}

      <span>{label}</span>
    </button>
  );
}

function MatchGrid({
  correctPairs,
  flashingPair,
  leftItems,
  onTapLeft,
  onTapRight,
  rightItems,
  selectedLeft,
}: {
  correctPairs: Pair[];
  flashingPair: Pair | null;
  leftItems: string[];
  onTapLeft: (item: string) => void;
  onTapRight: (item: string) => void;
  rightItems: string[];
  selectedLeft: string | null;
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
          selectedLeft,
          side: "left",
        });

        const rightState = getItemVisualState({
          correctPairs,
          flashingPair,
          item: right,
          selectedLeft,
          side: "right",
        });

        return (
          <Fragment key={left}>
            <MatchItem label={left} onTap={() => onTapLeft(left)} state={leftState} />
            <MatchItem label={right} onTap={() => onTapRight(right)} state={rightState} />
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

  const shuffledRight = useMemo(
    () => shuffle(content.pairs.map((pair) => pair.right)),
    [content.pairs],
  );

  const leftItems = useMemo(() => content.pairs.map((pair) => pair.left), [content.pairs]);

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [correctPairs, setCorrectPairs] = useState<Pair[]>([]);
  const [flashingPair, setFlashingPair] = useState<Pair | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTapLeft = useCallback(
    (item: string) => {
      if (correctPairs.some((pair) => pair.left === item)) {
        return;
      }

      if (flashingPair) {
        return;
      }

      setSelectedLeft(selectedLeft === item ? null : item);
    },
    [correctPairs, flashingPair, selectedLeft],
  );

  const handleTapRight = useCallback(
    (item: string) => {
      if (correctPairs.some((pair) => pair.right === item)) {
        return;
      }

      if (flashingPair) {
        return;
      }

      if (!selectedLeft) {
        return;
      }

      const pair: Pair = { left: selectedLeft, right: item };
      const isCorrectPair = checkSingleMatchPair(content, pair);

      if (isCorrectPair) {
        const nextCorrect = [...correctPairs, pair];
        setCorrectPairs(nextCorrect);
        setSelectedLeft(null);

        if (nextCorrect.length === content.pairs.length) {
          onSelectAnswer(step.id, {
            kind: "matchColumns",
            mistakes,
            userPairs: nextCorrect,
          });
        }
      } else {
        setMistakes((prev) => prev + 1);
        setFlashingPair(pair);
        setSelectedLeft(null);

        if (flashTimeoutRef.current) {
          clearTimeout(flashTimeoutRef.current);
        }

        flashTimeoutRef.current = setTimeout(() => {
          setFlashingPair(null);
          flashTimeoutRef.current = null;
        }, FLASH_DURATION);
      }
    },
    [content, correctPairs, flashingPair, mistakes, onSelectAnswer, selectedLeft, step.id],
  );

  const allMatched = correctPairs.length === content.pairs.length;

  return (
    <InteractiveStepLayout>
      {content.question && <QuestionText>{replaceName(content.question)}</QuestionText>}

      <MatchGrid
        correctPairs={correctPairs}
        flashingPair={flashingPair}
        leftItems={leftItems}
        onTapLeft={handleTapLeft}
        onTapRight={handleTapRight}
        rightItems={shuffledRight}
        selectedLeft={selectedLeft}
      />

      <div aria-live="polite" className="sr-only" role="status">
        {allMatched && t("All pairs matched. Press Check to continue.")}
      </div>
    </InteractiveStepLayout>
  );
}

"use client";

import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { shuffle } from "@zoonk/utils/shuffle";
import { useExtracted } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { type SelectedAnswer } from "./player-reducer";
import { QuestionText } from "./question-text";
import { InteractiveStepLayout } from "./step-layouts";
import { useReplaceName } from "./user-name-context";

type Pair = { left: string; right: string };

function findMatch(matchedPairs: Pair[], item: string, side: "left" | "right"): Pair | undefined {
  return matchedPairs.find((pair) => pair[side] === item);
}

function MatchItem({
  isMatched,
  isSelected,
  label,
  onTap,
}: {
  isMatched: boolean;
  isSelected: boolean;
  label: string;
  onTap: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={isSelected}
      className={cn(
        "border-border min-h-11 rounded-lg border px-4 py-3.5 text-left transition-all duration-150",
        isMatched && "opacity-50",
        isSelected && "border-primary bg-primary/5",
        !isMatched &&
          !isSelected &&
          "hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
      )}
      onClick={onTap}
      type="button"
    >
      {label}
    </button>
  );
}

function MatchGrid({
  leftItems,
  matchedPairs,
  onTapLeft,
  onTapRight,
  rightItems,
  selectedLeft,
}: {
  leftItems: string[];
  matchedPairs: Pair[];
  onTapLeft: (item: string) => void;
  onTapRight: (item: string) => void;
  rightItems: string[];
  selectedLeft: string | null;
}) {
  const t = useExtracted();

  return (
    <div className="grid grid-cols-2 gap-3">
      <div aria-label={t("Left column")} className="flex flex-col gap-3" role="group">
        {leftItems.map((item) => {
          const match = findMatch(matchedPairs, item, "left");
          const isMatched = match !== undefined;
          const isSelected = selectedLeft === item && !isMatched;
          const label = isMatched
            ? t("{item}, matched with {match}. Tap to unmatch.", {
                item,
                match: match.right,
              })
            : item;

          return (
            <MatchItem
              isMatched={isMatched}
              isSelected={isSelected}
              key={item}
              label={label}
              onTap={() => onTapLeft(item)}
            />
          );
        })}
      </div>

      <div aria-label={t("Right column")} className="flex flex-col gap-3" role="group">
        {rightItems.map((item) => {
          const match = findMatch(matchedPairs, item, "right");
          const isMatched = match !== undefined;
          const label = isMatched
            ? t("{item}, matched with {match}. Tap to unmatch.", {
                item,
                match: match.left,
              })
            : item;

          return (
            <MatchItem
              isMatched={isMatched}
              isSelected={false}
              key={item}
              label={label}
              onTap={() => onTapRight(item)}
            />
          );
        })}
      </div>
    </div>
  );
}

export function MatchColumnsStep({
  onSelectAnswer,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const content = useMemo(() => parseStepContent("matchColumns", step.content), [step.content]);
  const replaceName = useReplaceName();

  const shuffledRight = useMemo(
    () => shuffle(content.pairs.map((pair) => pair.right)),
    [content.pairs],
  );

  const leftItems = useMemo(() => content.pairs.map((pair) => pair.left), [content.pairs]);

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Pair[]>([]);

  const handleTapLeft = useCallback(
    (item: string) => {
      const existingMatch = findMatch(matchedPairs, item, "left");

      if (existingMatch) {
        const next = matchedPairs.filter((pair) => pair.left !== item);
        setMatchedPairs(next);
        setSelectedLeft(null);

        if (selectedAnswer) {
          onSelectAnswer(step.id, null);
        }

        return;
      }

      setSelectedLeft(selectedLeft === item ? null : item);
    },
    [matchedPairs, onSelectAnswer, selectedAnswer, selectedLeft, step.id],
  );

  const handleTapRight = useCallback(
    (item: string) => {
      const existingMatch = findMatch(matchedPairs, item, "right");

      if (existingMatch) {
        const next = matchedPairs.filter((pair) => pair.right !== item);
        setMatchedPairs(next);
        setSelectedLeft(null);

        if (selectedAnswer) {
          onSelectAnswer(step.id, null);
        }

        return;
      }

      if (!selectedLeft) {
        return;
      }

      const newPair: Pair = { left: selectedLeft, right: item };
      const next = [...matchedPairs, newPair];
      setMatchedPairs(next);
      setSelectedLeft(null);

      if (next.length === content.pairs.length) {
        onSelectAnswer(step.id, { kind: "matchColumns", userPairs: next });
      }
    },
    [content.pairs.length, matchedPairs, onSelectAnswer, selectedAnswer, selectedLeft, step.id],
  );

  return (
    <InteractiveStepLayout>
      {content.question ? <QuestionText>{replaceName(content.question)}</QuestionText> : null}

      <MatchGrid
        leftItems={leftItems}
        matchedPairs={matchedPairs}
        onTapLeft={handleTapLeft}
        onTapRight={handleTapRight}
        rightItems={shuffledRight}
        selectedLeft={selectedLeft}
      />
    </InteractiveStepLayout>
  );
}

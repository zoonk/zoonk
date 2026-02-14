"use client";

import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { Kbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { shuffle } from "@zoonk/utils/shuffle";
import { useExtracted } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { type SelectedAnswer } from "./player-reducer";
import { QuestionText } from "./question-text";
import { InteractiveStepLayout } from "./step-layouts";
import { useReplaceName } from "./user-name-context";

function OrderSlot({
  index,
  item,
  onRemove,
}: {
  index: number;
  item: string | null;
  onRemove: () => void;
}) {
  const t = useExtracted();
  const position = String(index + 1);

  if (item) {
    return (
      <button
        aria-label={t("Slot {position}: {item}. Tap to remove.", { item, position })}
        className="flex min-h-11 items-center gap-3 rounded-lg border border-transparent px-4 py-2.5 text-left transition-all duration-150"
        onClick={onRemove}
        type="button"
      >
        <Kbd className="bg-primary text-primary-foreground">{position}</Kbd>
        <span className="text-base">{item}</span>
      </button>
    );
  }

  return (
    <div
      aria-label={t("Slot {position}", { position })}
      className="border-border/50 flex min-h-11 items-center gap-3 rounded-lg border border-dashed px-4 py-2.5"
    >
      <Kbd>{position}</Kbd>
    </div>
  );
}

function SlotList({
  onRemove,
  slots,
}: {
  onRemove: (index: number) => void;
  slots: (string | null)[];
}) {
  const t = useExtracted();

  return (
    <div aria-label={t("Answer slots")} className="flex flex-col gap-2" role="list">
      {slots.map((item, index) => (
        <OrderSlot
          index={index}
          item={item}
          key={`slot-${index}`}
          onRemove={() => onRemove(index)}
        />
      ))}
    </div>
  );
}

function ItemTile({
  isUsed,
  onPlace,
  word,
}: {
  isUsed: boolean;
  onPlace: () => void;
  word: string;
}) {
  return (
    <button
      aria-disabled={isUsed}
      className={cn(
        "border-border min-h-11 rounded-lg border px-4 py-2.5 transition-all duration-150",
        isUsed
          ? "pointer-events-none opacity-50"
          : "hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
      )}
      onClick={onPlace}
      tabIndex={isUsed ? -1 : 0}
      type="button"
    >
      {word}
    </button>
  );
}

function ItemPool({
  onPlace,
  slots,
  words,
}: {
  onPlace: (word: string) => void;
  slots: (string | null)[];
  words: string[];
}) {
  const t = useExtracted();
  const usedWords = slots.filter(Boolean);

  return (
    <div aria-label={t("Available items")} className="flex flex-wrap gap-2.5" role="group">
      {words.map((word, index) => {
        const usedCount = usedWords.filter((used) => used === word).length;
        const totalCount = words.slice(0, index + 1).filter((item) => item === word).length;
        const isUsed = usedCount >= totalCount;

        return (
          <ItemTile
            isUsed={isUsed}
            key={`${word}-${index}`}
            onPlace={() => onPlace(word)}
            word={word}
          />
        );
      })}
    </div>
  );
}

function isComplete(slots: (string | null)[]): slots is string[] {
  return slots.every((slot) => slot !== null);
}

export function SortOrderStep({
  onSelectAnswer,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const content = useMemo(() => parseStepContent("sortOrder", step.content), [step.content]);
  const replaceName = useReplaceName();

  const shuffledItems = useMemo(() => shuffle(content.items), [content.items]);

  const [slots, setSlots] = useState<(string | null)[]>(() =>
    Array.from({ length: content.items.length }, () => null),
  );

  const handlePlace = useCallback(
    (word: string) => {
      const firstEmptyIndex = slots.indexOf(null);

      if (firstEmptyIndex === -1) {
        return;
      }

      const next = [...slots];
      next[firstEmptyIndex] = word;
      setSlots(next);

      if (isComplete(next)) {
        onSelectAnswer(step.id, { kind: "sortOrder", userOrder: next });
      }
    },
    [onSelectAnswer, slots, step.id],
  );

  const handleRemove = useCallback(
    (index: number) => {
      if (!slots[index]) {
        return;
      }

      const next = [...slots];
      next[index] = null;
      setSlots(next);

      if (selectedAnswer) {
        onSelectAnswer(step.id, null);
      }
    },
    [onSelectAnswer, selectedAnswer, slots, step.id],
  );

  return (
    <InteractiveStepLayout>
      {content.question ? <QuestionText>{replaceName(content.question)}</QuestionText> : null}

      <SlotList onRemove={handleRemove} slots={slots} />

      <ItemPool onPlace={handlePlace} slots={slots} words={shuffledItems} />
    </InteractiveStepLayout>
  );
}

"use client";

import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { Kbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { shuffle } from "@zoonk/utils/shuffle";
import { CircleCheck, CircleX } from "lucide-react";
import { useExtracted } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { type SelectedAnswer, type StepResult } from "./player-reducer";
import { QuestionText } from "./question-text";
import { InteractiveStepLayout } from "./step-layouts";
import { useReplaceName } from "./user-name-context";

function getSlotResultState(
  item: string,
  index: number,
  correctItems: string[],
): "correct" | "incorrect" | null {
  const correctItem = correctItems[index];

  if (!correctItem) {
    return null;
  }

  return item === correctItem ? "correct" : "incorrect";
}

function OrderSlot({
  index,
  item,
  onRemove,
  resultState,
}: {
  index: number;
  item: string | null;
  onRemove: () => void;
  resultState?: "correct" | "incorrect" | null;
}) {
  const t = useExtracted();
  const position = String(index + 1);
  const hasResult = resultState !== undefined && resultState !== null;

  if (item) {
    const ariaLabel = hasResult
      ? t("Slot {position}: {item}. {result}.", {
          item,
          position,
          result: resultState === "correct" ? t("Correct") : t("Incorrect"),
        })
      : t("Slot {position}: {item}. Tap to remove.", { item, position });

    return (
      <button
        aria-label={ariaLabel}
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left transition-all duration-150 sm:px-4 sm:py-2.5",
          hasResult && "pointer-events-none",
          resultState === "correct" && "border-l-success border-l-2",
          resultState === "incorrect" && "border-l-destructive border-l-2",
        )}
        disabled={hasResult}
        onClick={onRemove}
        type="button"
      >
        <Kbd
          className={cn(
            "bg-primary text-primary-foreground",
            resultState === "correct" && "bg-success text-white",
            resultState === "incorrect" && "bg-destructive text-white",
          )}
        >
          {position}
        </Kbd>
        <span className="text-base">{item}</span>
      </button>
    );
  }

  return (
    <div
      aria-label={t("Slot {position}", { position })}
      className="border-border/50 flex min-h-11 items-center gap-3 rounded-lg border border-dashed px-3 py-2 sm:px-4 sm:py-2.5"
    >
      <Kbd>{position}</Kbd>
    </div>
  );
}

function SlotList({
  correctItems,
  onRemove,
  slots,
}: {
  correctItems?: string[];
  onRemove: (index: number) => void;
  slots: (string | null)[];
}) {
  const t = useExtracted();

  return (
    <div aria-label={t("Answer slots")} className="flex flex-col gap-2" role="list">
      {slots.map((item, index) => {
        const resultState =
          correctItems && item ? getSlotResultState(item, index, correctItems) : undefined;

        return (
          <OrderSlot
            index={index}
            item={item}
            key={`slot-${index}`}
            onRemove={() => onRemove(index)}
            resultState={resultState}
          />
        );
      })}
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
        "border-border min-h-11 w-full rounded-lg border px-4 py-2.5 text-left transition-all duration-150",
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
    <div aria-label={t("Available items")} className="flex flex-col gap-2" role="group">
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

function InlineFeedback({
  content,
  result,
}: {
  content: { feedback: string | null; items: string[] };
  result: StepResult;
}) {
  const t = useExtracted();
  const replaceName = useReplaceName();
  const isCorrect = result.result.isCorrect;
  const feedback = content.feedback ? replaceName(content.feedback) : null;

  return (
    <div className="flex flex-col gap-3">
      <div
        aria-live="polite"
        className={cn(
          "flex items-center gap-1.5 text-sm font-medium",
          isCorrect ? "text-success" : "text-destructive",
        )}
        role="status"
      >
        {isCorrect ? (
          <CircleCheck aria-hidden="true" className="size-4" />
        ) : (
          <CircleX aria-hidden="true" className="size-4" />
        )}
        <span>{isCorrect ? t("Correct!") : t("Not quite")}</span>
      </div>

      {feedback ? <p className="text-muted-foreground text-base">{feedback}</p> : null}

      {isCorrect ? null : (
        <div className="text-muted-foreground text-sm">
          <p className="font-medium">{t("Correct order:")}</p>
          <ol className="mt-1 list-inside list-decimal">
            {content.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function isComplete(slots: (string | null)[]): slots is string[] {
  return slots.every((slot) => slot !== null);
}

export function SortOrderStep({
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const content = useMemo(() => parseStepContent("sortOrder", step.content), [step.content]);
  const replaceName = useReplaceName();

  const shuffledItems = useMemo(() => shuffle(content.items), [content.items]);

  const [slots, setSlots] = useState<(string | null)[]>(() => {
    if (result?.answer?.kind === "sortOrder") {
      return result.answer.userOrder;
    }

    return Array.from({ length: content.items.length }, () => null);
  });

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

  const hasResult = result !== undefined;

  return (
    <InteractiveStepLayout>
      {content.question ? <QuestionText>{replaceName(content.question)}</QuestionText> : null}

      <SlotList
        correctItems={hasResult ? content.items : undefined}
        onRemove={handleRemove}
        slots={slots}
      />

      {hasResult ? null : <ItemPool onPlace={handlePlace} slots={slots} words={shuffledItems} />}

      {result ? <InlineFeedback content={content} result={result} /> : null}
    </InteractiveStepLayout>
  );
}

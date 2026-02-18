"use client";

import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useExtracted } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InlineFeedback } from "./inline-feedback";
import { type SelectedAnswer, type StepResult } from "./player-reducer";
import { QuestionText } from "./question-text";
import { ResultKbd } from "./result-kbd";
import { InteractiveStepLayout } from "./step-layouts";
import { useReplaceName } from "./user-name-context";

type OrderItem = {
  id: string;
  text: string;
};

function getUserPosition(item: string, userOrder: string[]): number {
  return userOrder.indexOf(item) + 1;
}

function getFocusDirection(fromIndex: number, toIndex: number, itemCount: number): "down" | "up" {
  const atBoundary =
    (toIndex === 0 && fromIndex > toIndex) || (toIndex === itemCount - 1 && fromIndex < toIndex);

  if (atBoundary) {
    return fromIndex < toIndex ? "up" : "down";
  }

  return fromIndex < toIndex ? "down" : "up";
}

function ReorderRow({
  index,
  isLast,
  item,
  onMove,
}: {
  index: number;
  isLast: boolean;
  item: OrderItem;
  onMove: (fromIndex: number, toIndex: number) => void;
}) {
  const t = useExtracted();
  const isFirst = index === 0;

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowUp" && !isFirst) {
      event.preventDefault();
      onMove(index, index - 1);
    }

    if (event.key === "ArrowDown" && !isLast) {
      event.preventDefault();
      onMove(index, index + 1);
    }
  }

  return (
    <div
      aria-label={t("Position {position}: {item}", {
        item: item.text,
        position: String(index + 1),
      })}
      className="border-border flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all duration-150 motion-reduce:transition-none sm:px-4 sm:py-2.5"
      onKeyDown={handleKeyDown}
      role="listitem"
    >
      <ResultKbd isSelected>{String(index + 1)}</ResultKbd>

      <span className="min-w-0 flex-1 text-base">{item.text}</span>

      <span className="ml-auto flex shrink-0 gap-0.5">
        {isFirst ? (
          <span aria-hidden="true" className="size-8" />
        ) : (
          <Button
            aria-label={t("Move {item} up", { item: item.text })}
            onClick={() => {
              onMove(index, index - 1);
            }}
            size="icon-sm"
            variant="ghost"
          >
            <ChevronUp className="size-4" />
          </Button>
        )}

        {isLast ? (
          <span aria-hidden="true" className="size-8" />
        ) : (
          <Button
            aria-label={t("Move {item} down", { item: item.text })}
            onClick={() => {
              onMove(index, index + 1);
            }}
            size="icon-sm"
            variant="ghost"
          >
            <ChevronDown className="size-4" />
          </Button>
        )}
      </span>
    </div>
  );
}

function FeedbackRow({
  correctIndex,
  item,
  userOrder,
}: {
  correctIndex: number;
  item: string;
  userOrder: string[];
}) {
  const t = useExtracted();
  const userPosition = getUserPosition(item, userOrder);
  const isCorrect = userPosition === correctIndex + 1;
  const resultState = isCorrect ? "correct" : "incorrect";

  return (
    <div
      aria-label={`${item}. ${isCorrect ? t("Correct") : t("Incorrect")}.`}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-left sm:px-4 sm:py-2.5",
        "pointer-events-none",
        resultState === "correct" && "border-l-success border-l-2",
        resultState === "incorrect" && "border-l-destructive border-l-2",
      )}
      role="listitem"
    >
      <ResultKbd resultState={resultState}>{String(correctIndex + 1)}</ResultKbd>

      <span className="text-base">{item}</span>

      {!isCorrect && (
        <span className="text-muted-foreground ml-auto text-xs">
          {t("you had: #{position}", { position: String(userPosition) })}
        </span>
      )}
    </div>
  );
}

export function SortOrderStep({
  onSelectAnswer,
  result,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  const t = useExtracted();
  const content = useMemo(() => parseStepContent("sortOrder", step.content), [step.content]);
  const replaceName = useReplaceName();

  const initialItems = useMemo<OrderItem[]>(
    () => step.sortOrderItems.map((text, index) => ({ id: `item-${index}`, text })),
    [step.sortOrderItems],
  );

  const [items, setItems] = useState<OrderItem[]>(() => {
    if (result?.answer?.kind === "sortOrder") {
      return result.answer.userOrder.map((text, index) => ({ id: `item-${index}`, text }));
    }

    return initialItems;
  });

  const [announcement, setAnnouncement] = useState("");
  const focusTarget = useRef<{ direction: "down" | "up"; itemIndex: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Register initial shuffled order as the answer on mount
  useEffect(() => {
    if (!result) {
      onSelectAnswer(step.id, {
        kind: "sortOrder",
        userOrder: items.map((item) => item.text),
      });
    }
    // Only run on mount
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus management after a move
  useEffect(() => {
    if (!focusTarget.current || !listRef.current) {
      return;
    }

    const { direction, itemIndex } = focusTarget.current;
    const row = listRef.current.querySelectorAll("[role='listitem']")[itemIndex];

    if (row) {
      const selector = `button[aria-label*="${direction === "up" ? "up" : "down"}"]`;
      const button = row.querySelector<HTMLButtonElement>(selector);

      if (button) {
        button.focus();
      } else {
        // At boundary — focus opposite arrow
        const opposite = `button[aria-label*="${direction === "up" ? "down" : "up"}"]`;
        row.querySelector<HTMLButtonElement>(opposite)?.focus();
      }
    }

    focusTarget.current = null;
  }, [items]);

  const handleMove = useCallback(
    (fromIndex: number, toIndex: number) => {
      const moved = items[fromIndex];

      if (!moved) {
        return;
      }

      const next = [...items];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);

      setItems(next);

      onSelectAnswer(step.id, {
        kind: "sortOrder",
        userOrder: next.map((item) => item.text),
      });

      setAnnouncement(
        t("{item} moved to position {position}", {
          item: moved.text,
          position: String(toIndex + 1),
        }),
      );

      focusTarget.current = {
        direction: getFocusDirection(fromIndex, toIndex, next.length),
        itemIndex: toIndex,
      };
    },
    [items, onSelectAnswer, step.id, t],
  );

  const hasResult = result !== undefined;
  const isIncorrect = hasResult && !result.result.isCorrect;
  const userOrder = items.map((item) => item.text);

  return (
    <InteractiveStepLayout>
      {content.question && <QuestionText>{replaceName(content.question)}</QuestionText>}

      {!hasResult && <p className="text-muted-foreground text-sm">{t("Tap arrows to reorder")}</p>}

      {hasResult && (
        <div aria-label={t("Sort items")} className="flex flex-col gap-2" role="list">
          {content.items.map((item, index) => (
            <FeedbackRow
              correctIndex={index}
              item={item}
              // oxlint-disable-next-line react/no-array-index-key -- Items can repeat, no unique ID
              key={`feedback-${index}`}
              userOrder={userOrder}
            />
          ))}
        </div>
      )}

      {!hasResult && (
        <div aria-label={t("Sort items")} className="flex flex-col gap-2" ref={listRef} role="list">
          {items.map((item, index) => (
            <ReorderRow
              index={index}
              isLast={index === items.length - 1}
              item={item}
              // oxlint-disable-next-line react/no-array-index-key -- Items can repeat, no unique ID
              key={item.id}
              onMove={handleMove}
            />
          ))}
        </div>
      )}

      <div aria-live="polite" className="sr-only" role="status">
        {announcement}
      </div>

      {result && (
        <InlineFeedback result={result}>
          {isIncorrect && (
            <p className="text-muted-foreground text-sm">
              {t("Correct order: {answer}", { answer: content.items.join(" → ") })}
            </p>
          )}
        </InlineFeedback>
      )}
    </InteractiveStepLayout>
  );
}

"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-activity-data";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useCallback, useId, useMemo, useState } from "react";
import { type StepResult } from "../player-reducer";
import { RomanizationText } from "./romanization-text";

export type PlacedWord = WordBankOption & { id: string };

function getWordResultState(
  word: string,
  position: number,
  correctWords: string[],
): "correct" | "incorrect" {
  return correctWords[position] === word ? "correct" : "incorrect";
}

function PlacedWordTile({
  id,
  onClick,
  option,
  position,
  resultState,
}: {
  id: string;
  onClick: () => void;
  option: WordBankOption;
  position: number;
  resultState?: "correct" | "incorrect";
}) {
  const t = useExtracted();
  const hasResult = resultState !== undefined;

  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    disabled: hasResult,
    id,
  });

  const ariaLabel = (() => {
    if (hasResult) {
      const result = resultState === "correct" ? t("Correct") : t("Incorrect");
      return t("{item}. {result}.", { item: option.word, result });
    }

    return t("Position {position}: {item}. Tap to remove.", {
      item: option.word,
      position: String(position + 1),
    });
  })();

  return (
    <button
      {...attributes}
      {...listeners}
      aria-label={ariaLabel}
      className={cn(
        "border-border flex min-h-11 flex-col items-center justify-center rounded-lg border px-4 py-2.5 text-base transition-all duration-150",
        hasResult && "pointer-events-none",
        !hasResult &&
          "hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
        !hasResult && "touch-none select-none",
        isDragging && "opacity-30",
        resultState === "correct" && "bg-success/5 text-success border-transparent opacity-75",
        resultState === "incorrect" &&
          "bg-destructive/5 text-destructive border-transparent opacity-75",
      )}
      disabled={hasResult}
      onClick={onClick}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      type="button"
    >
      <span>{option.word}</span>

      <RomanizationText>{option.romanization}</RomanizationText>
    </button>
  );
}

function DragOverlayWord({ option }: { option: WordBankOption }) {
  return (
    <div className="bg-background border-border flex min-h-11 flex-col items-center justify-center rounded-lg border px-4 py-2.5 text-base shadow-md">
      <span>{option.word}</span>
      <RomanizationText>{option.romanization}</RomanizationText>
    </div>
  );
}

export function ArrangeWordsAnswerArea({
  correctWords,
  onDragEnd,
  onDragStart,
  onRemove,
  placedWords,
  result,
}: {
  correctWords: string[];
  onDragEnd: (event: DragEndEvent) => void;
  onDragStart: (event: DragStartEvent) => void;
  onRemove: (index: number) => void;
  placedWords: PlacedWord[];
  result?: StepResult;
}) {
  const t = useExtracted();
  const dndId = useId();
  const hasResult = result !== undefined;
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(String(event.active.id));
      onDragStart(event);
    },
    [onDragStart],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      onDragEnd(event);
    },
    [onDragEnd],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const itemIds = useMemo(() => placedWords.map((pw) => pw.id), [placedWords]);
  const activeItem = activeId ? placedWords.find((pw) => pw.id === activeId) : null;

  return (
    <DndContext
      collisionDetection={closestCenter}
      id={dndId}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={hasResult ? undefined : sensors}
    >
      <SortableContext items={itemIds} strategy={rectSortingStrategy}>
        <div
          aria-label={t("Your answer")}
          className="border-border/40 flex min-h-16 flex-wrap gap-2 border-b pb-3"
          role="group"
        >
          {placedWords.length === 0 ? (
            <p className="text-muted-foreground/60 text-sm">
              {t("Tap words to build your answer")}
            </p>
          ) : (
            placedWords.map((option, index) => (
              <PlacedWordTile
                id={option.id}
                key={option.id}
                onClick={() => onRemove(index)}
                option={option}
                position={index}
                resultState={
                  result ? getWordResultState(option.word, index, correctWords) : undefined
                }
              />
            ))
          )}
        </div>
      </SortableContext>

      <DragOverlay>{activeItem && <DragOverlayWord option={activeItem} />}</DragOverlay>
    </DndContext>
  );
}

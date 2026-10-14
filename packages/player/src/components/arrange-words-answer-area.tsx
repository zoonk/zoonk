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
import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { ANSWER_TONE } from "@zoonk/learn/answer-tone";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useCallback, useId, useMemo, useState } from "react";
import { type StepResult } from "../step-answer";
import { RomanizationText } from "./romanization-text";
import { WORD_CHIP_CLASS } from "./word-bank-option-content";

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
  const hasResult = Boolean(resultState);

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
        WORD_CHIP_CLASS,
        hasResult ? "pointer-events-none" : "hover:bg-muted/60 touch-none select-none",
        isDragging && "opacity-30",
        resultState === "correct" && ANSWER_TONE.right,
        resultState === "incorrect" && ANSWER_TONE.wrong,
      )}
      disabled={hasResult}
      onClick={onClick}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      type="button"
    >
      <span>{option.word}</span>

      <RomanizationText>{option.romanization}</RomanizationText>
    </button>
  );
}

/** The word under the finger while it's dragged: lifted by a firm line, not a shadow. */
function DragOverlayWord({ option }: { option: WordBankOption }) {
  return (
    <div className={cn(WORD_CHIP_CLASS, "bg-background ring-foreground")}>
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
          className="border-border flex min-h-16 flex-wrap gap-2 border-b pb-3"
          role="group"
        >
          {placedWords.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("Pick words to build your answer")}</p>
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

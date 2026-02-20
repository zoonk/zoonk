"use client";

import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { InlineFeedback } from "./inline-feedback";
import { type SelectedAnswer, type StepResult } from "./player-reducer";
import { QuestionText } from "./question-text";
import { ResultKbd } from "./result-kbd";
import { InteractiveStepLayout } from "./step-layouts";
import { useReplaceName } from "./user-name-context";

type SortItem = { id: string; text: string };

function getItemResultState(
  item: string,
  position: number,
  userOrder: string[],
): "correct" | "incorrect" {
  return userOrder[position] === item ? "correct" : "incorrect";
}

function SortableItem({
  activeId,
  index,
  item,
}: {
  activeId: string | null;
  index: number;
  item: SortItem;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      className={cn("rounded-lg border", isDragging && "opacity-30")}
      ref={setNodeRef}
      role="listitem"
      style={style}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={item.text}
        className={cn(
          "flex min-h-11 w-full touch-none items-center gap-3 px-3 py-2 text-left select-none sm:px-4 sm:py-2.5",
          !isDragging && "hover:bg-muted/50",
          activeId ? "cursor-grabbing" : "cursor-grab",
        )}
        type="button"
      >
        <ResultKbd isSelected>{String(index + 1)}</ResultKbd>
        <span className="text-base">{item.text}</span>
      </button>
    </div>
  );
}

function DragOverlayItem({ index, item }: { index: number; item: SortItem }) {
  return (
    <div className="bg-background flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-left shadow-md sm:px-4 sm:py-2.5">
      <ResultKbd isSelected>{String(index + 1)}</ResultKbd>
      <span className="text-base">{item.text}</span>
    </div>
  );
}

function SortableItemList({
  items,
  onReorder,
}: {
  items: SortItem[];
  onReorder: (reordered: SortItem[]) => void;
}) {
  const t = useExtracted();
  const dndId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }

    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = items.findIndex((item) => item.id === String(active.id));
      const newIndex = items.findIndex((item) => item.id === String(over.id));

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      onReorder(arrayMove(items, oldIndex, newIndex));
    },
    [items, onReorder],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const activeItem = activeId ? items.find((item) => item.id === activeId) : null;
  const activeIndex = activeItem ? items.indexOf(activeItem) : -1;

  return (
    <DndContext
      collisionDetection={closestCenter}
      id={dndId}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div aria-label={t("Sort items")} className="flex flex-col gap-2" role="list">
          {items.map((item, index) => (
            <SortableItem activeId={activeId} index={index} item={item} key={item.id} />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeItem && <DragOverlayItem index={activeIndex} item={activeItem} />}
      </DragOverlay>
    </DndContext>
  );
}

function ResultItemList({
  correctItems,
  isCorrect,
  userOrder,
}: {
  correctItems: string[];
  isCorrect: boolean;
  userOrder: string[];
}) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-2">
      {!isCorrect && (
        <p className="text-muted-foreground text-sm font-medium">{t("Correct order:")}</p>
      )}

      <div aria-label={t("Sort items")} className="flex flex-col gap-2" role="list">
        {correctItems.map((item, index) => {
          const resultState = getItemResultState(item, index, userOrder);

          return (
            <div
              aria-label={t("{item}. {result}.", {
                item,
                result: resultState === "correct" ? t("Correct") : t("Incorrect"),
              })}
              className={cn(
                "pointer-events-none flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-left sm:px-4 sm:py-2.5",
                resultState === "correct" && "border-l-success border-l-2",
                resultState === "incorrect" && "border-l-destructive border-l-2",
              )}
              // oxlint-disable-next-line react/no-array-index-key -- Items can repeat, no unique ID
              key={`${item}-${index}`}
              role="listitem"
            >
              <ResultKbd resultState={resultState}>{String(index + 1)}</ResultKbd>
              <span className="text-base">{item}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function initItems(step: SerializedStep, result?: StepResult): SortItem[] {
  if (result?.answer?.kind === "sortOrder") {
    return result.answer.userOrder.map((text, index) => ({ id: String(index), text }));
  }

  return step.sortOrderItems.map((text, index) => ({ id: String(index), text }));
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
  const [items, setItems] = useState<SortItem[]>(() => initItems(step, result));

  // Register the initial shuffled order as the answer on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only effect
  useEffect(() => {
    if (!result) {
      onSelectAnswer(step.id, {
        kind: "sortOrder",
        userOrder: items.map((item) => item.text),
      });
    }
  }, []); // oxlint-disable-line react-hooks/exhaustive-deps -- mount-only

  const handleReorder = useCallback(
    (reordered: SortItem[]) => {
      setItems(reordered);
      onSelectAnswer(step.id, {
        kind: "sortOrder",
        userOrder: reordered.map((item) => item.text),
      });
    },
    [onSelectAnswer, step.id],
  );

  const hasResult = result !== undefined;
  const userOrder = items.map((item) => item.text);

  return (
    <InteractiveStepLayout>
      {content.question && <QuestionText>{replaceName(content.question)}</QuestionText>}

      {!hasResult && (
        <p className="text-muted-foreground text-sm">{t("Drag items into the correct order")}</p>
      )}

      {hasResult ? (
        <ResultItemList
          correctItems={content.items}
          isCorrect={result.result.isCorrect}
          userOrder={userOrder}
        />
      ) : (
        <SortableItemList items={items} onReorder={handleReorder} />
      )}

      {result && <InlineFeedback result={result} />}
    </InteractiveStepLayout>
  );
}

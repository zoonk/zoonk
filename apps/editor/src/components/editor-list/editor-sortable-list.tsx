"use client";

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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { toast } from "@zoonk/ui/components/sonner";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { cn } from "@zoonk/ui/lib/utils";
import { useCallback, useId, useMemo, useOptimistic, useState, useTransition } from "react";
import {
  EditorSortableContext,
  type EditorSortableContextValue,
  type SortableItem,
} from "./editor-sortable-context";

export function EditorSortableList<T extends SortableItem>({
  children,
  items: initialItems,
  onReorder,
  renderOverlay,
}: {
  children: React.ReactNode;
  items: T[];
  onReorder: (items: { id: number; position: number }[]) => Promise<{ error: string | null }>;
  renderOverlay?: (activeItem: T) => React.ReactNode;
}) {
  const dndId = useId();
  const mounted = useIsMounted();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [optimisticItems, setOptimisticItems] = useOptimistic(initialItems);
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
    setActiveId(Number(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = optimisticItems.findIndex((item) => item.id === active.id);
      const newIndex = optimisticItems.findIndex((item) => item.id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const reorderedItems = arrayMove(optimisticItems, oldIndex, newIndex);
      const newPositions = reorderedItems.map((item: SortableItem, index: number) => ({
        id: item.id,
        position: index,
      }));

      startTransition(async () => {
        setOptimisticItems(reorderedItems);

        const { error } = await onReorder(newPositions);

        if (error) {
          toast.error(error);
        }
      });
    },
    [optimisticItems, onReorder, setOptimisticItems],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const activeItem = activeId ? optimisticItems.find((item) => item.id === activeId) : null;

  const contextValue = useMemo<EditorSortableContextValue>(
    () => ({
      activeId,
      isDragging: activeId !== null,
    }),
    [activeId],
  );

  const itemIds = useMemo(() => optimisticItems.map((item) => item.id), [optimisticItems]);

  if (!mounted) {
    return <div data-slot="editor-sortable-list">{children}</div>;
  }

  return (
    <EditorSortableContext.Provider value={contextValue}>
      <DndContext
        collisionDetection={closestCenter}
        id={dndId}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div
            className={cn(pending && "pointer-events-none opacity-60")}
            data-slot="editor-sortable-list"
          >
            {children}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeItem && renderOverlay && (
            <div
              className="bg-background rounded-md border shadow-md"
              data-slot="editor-drag-overlay"
            >
              {renderOverlay(activeItem)}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </EditorSortableContext.Provider>
  );
}

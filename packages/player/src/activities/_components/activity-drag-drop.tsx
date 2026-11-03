"use client";

import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useId, useRef } from "react";

const POINTER_DISTANCE = 5;
const TOUCH_DELAY_MS = 200;

const dropUnderPointer: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  return underPointer.length > 0 ? underPointer : rectIntersection(args);
};

function silent(): string {
  return "";
}

const SILENT = {
  announcements: {
    onDragCancel: silent,
    onDragEnd: silent,
    onDragOver: silent,
    onDragStart: silent,
  },
  screenReaderInstructions: { draggable: "" },
};

/** Separate mouse and touch sensors preserve hold-to-drag alongside native touch scrolling. */
export function ActivityDragDrop({
  children,
  onDrop,
  underPointerOnly = false,
}: {
  children: React.ReactNode;
  onDrop: (itemId: string, targetId: string) => void;
  /** Ignores targets the piece only overlaps, for pieces so big that overlap isn't where the learner aims. */
  underPointerOnly?: boolean;
}) {
  const id = useId();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: POINTER_DISTANCE } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: TOUCH_DELAY_MS, tolerance: POINTER_DISTANCE },
    }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over && over.id !== active.data.current?.from) {
      onDrop(String(active.id), String(over.id));
    }
  }

  return (
    <DndContext
      accessibility={SILENT}
      collisionDetection={underPointerOnly ? pointerWithin : dropUnderPointer}
      id={id}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      {children}
    </DndContext>
  );
}

/**
 * Use `touch-manipulation` and check `isClickAfterDrag()` in onClick; browsers click after a drag.
 * `from` names the target the piece already sits on: it doesn't light up, and a drop there changes nothing.
 */
export function useActivityDraggable({
  disabled,
  from,
  id,
}: {
  disabled?: boolean;
  from?: string;
  id: string;
}) {
  const { isDragging, listeners, setNodeRef, transform } = useDraggable({
    data: { from },
    disabled,
    id,
  });

  const draggedRef = useRef(false);

  /* The click, when it comes, fires in the same task as the drop; the reset waits for the next. */
  useEffect(() => {
    if (isDragging) {
      draggedRef.current = true;
      return;
    }

    const timer = setTimeout(() => {
      draggedRef.current = false;
    }, 0);

    return () => clearTimeout(timer);
  }, [isDragging]);

  function isClickAfterDrag(): boolean {
    const dragged = draggedRef.current;
    draggedRef.current = false;
    return dragged;
  }

  return {
    dragProps: {
      ...listeners,
      ref: setNodeRef,
      style: transform ? { transform: CSS.Translate.toString(transform) } : undefined,
    },
    isClickAfterDrag,
    isDragging,
  };
}

export function useActivityDropTarget({ disabled, id }: { disabled?: boolean; id: string }) {
  const { active, isOver, setNodeRef } = useDroppable({ disabled, id });
  return { dropRef: setNodeRef, isOver: isOver && active?.data.current?.from !== id };
}

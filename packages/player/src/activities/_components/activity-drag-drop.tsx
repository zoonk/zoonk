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

/**
 * The target under the pointer or finger wins, so a wide item dropped on a small pin lands on the
 * pin it's over rather than the neighbor it covers most; when nothing is under the pointer, the
 * target the item covers most takes it.
 */
const dropUnderPointer: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  return underPointer.length > 0 ? underPointer : rectIntersection(args);
};

/** An empty announcement isn't read out. */
function silent(): string {
  return "";
}

/**
 * Keyboard and screen reader users place items with the tap path, and the activity announces
 * every placement itself, so dragging says nothing more.
 */
const SILENT = {
  announcements: {
    onDragCancel: silent,
    onDragEnd: silent,
    onDragOver: silent,
    onDragStart: silent,
  },
  screenReaderInstructions: { draggable: "" },
};

/**
 * Dragging for pointers and touch, on top of a tap path that already does everything: tap an
 * item, then tap where it goes. Dragging is a shortcut, never the only way, so there's no
 * keyboard sensor; the buttons are the keyboard path.
 *
 * A finger lifts an item by pressing and holding it, so a quick swipe over the items still
 * scrolls the lesson. That needs the mouse and touch sensors: a pointer sensor would take the
 * touch first (pointer events come before touch events) and lose it to the browser's scroll as
 * soon as the finger moves.
 */
export function ActivityDragDrop({
  children,
  onDrop,
}: {
  children: React.ReactNode;
  onDrop: (itemId: string, targetId: string) => void;
}) {
  const id = useId();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: POINTER_DISTANCE } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: TOUCH_DELAY_MS, tolerance: POINTER_DISTANCE },
    }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over) {
      onDrop(String(active.id), String(over.id));
    }
  }

  return (
    <DndContext
      accessibility={SILENT}
      collisionDetection={dropUnderPointer}
      id={id}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      {children}
    </DndContext>
  );
}

/**
 * Makes an element draggable by mouse and touch; spread `dragProps` on it and give it
 * `touch-manipulation` (not `touch-none`), so a swipe that starts on it scrolls the lesson.
 * Browsers still fire a click when a drag ends on the element, so its onClick checks
 * `isClickAfterDrag()` first.
 */
export function useActivityDraggable({ disabled, id }: { disabled?: boolean; id: string }) {
  const { isDragging, listeners, setNodeRef, transform } = useDraggable({ disabled, id });
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
  const { isOver, setNodeRef } = useDroppable({ disabled, id });
  return { dropRef: setNodeRef, isOver };
}

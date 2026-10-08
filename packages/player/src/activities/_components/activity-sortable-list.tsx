"use client";

import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  type ScreenReaderInstructions,
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
import { cn } from "@zoonk/ui/lib/utils";
import { GripVertical } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId } from "react";

type SortableItem = { id: string; label: string };

const POINTER_DISTANCE = 5;
const TOUCH_DELAY_MS = 200;

function useSortableAnnouncements(items: readonly SortableItem[]): {
  announcements: Announcements;
  instructions: ScreenReaderInstructions;
} {
  const t = useExtracted();
  const labelOf = (id: string | number) => items.find((item) => item.id === String(id))?.label;
  const positionOf = (id: string | number) => items.findIndex((item) => item.id === String(id)) + 1;

  return {
    announcements: {
      onDragCancel: ({ active }) =>
        t("Stopped moving {item}. It stays where it was.", { item: labelOf(active.id) ?? "" }),
      onDragEnd: ({ active, over }) =>
        t("{item} dropped at position {position}.", {
          item: labelOf(active.id) ?? "",
          position: String(positionOf(over?.id ?? active.id)),
        }),
      onDragOver: ({ active, over }) =>
        t("{item} is over position {position}.", {
          item: labelOf(active.id) ?? "",
          position: String(positionOf(over?.id ?? active.id)),
        }),
      onDragStart: ({ active }) =>
        t("Picked up {item} at position {position}.", {
          item: labelOf(active.id) ?? "",
          position: String(positionOf(active.id)),
        }),
    },
    instructions: {
      draggable: t(
        "To move an item, press Space or Enter, use the arrow keys to move it, then press Space or Enter again to drop it. Press Escape to cancel.",
      ),
    },
  };
}

function SortableRow({
  children,
  disabled,
  id,
  label,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  id: string;
  label: string;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    disabled,
    id,
  });

  return (
    <li
      className={cn("rounded-2xl border", isDragging && "bg-background relative z-10 shadow-md")}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={label}
        className={cn(
          "focus-visible:ring-ring/50 flex min-h-11 w-full touch-none items-start gap-3 rounded-2xl px-3 py-2 text-left outline-none select-none focus-visible:ring-[3px]",
          !disabled && "hover:bg-accent cursor-grab active:cursor-grabbing",
        )}
        disabled={disabled}
        type="button"
      >
        {/* Level with the item's first row (its 32px marks), not the middle of a long item. */}
        <span className="flex h-8 flex-none items-center">
          <GripVertical aria-hidden="true" className="text-muted-foreground size-4" />
        </span>
        {children}
      </button>
    </li>
  );
}

/**
 * A list the learner puts in order by dragging or with the keyboard (Space to pick up, arrows to
 * move, Space to drop), with every move announced to screen readers. The order is controlled:
 * `onReorder` gets the new ids and the caller turns them into an `order` answer.
 */
export function ActivitySortableList({
  disabled,
  items,
  label,
  onReorder,
  renderItem,
}: {
  disabled?: boolean;
  items: readonly SortableItem[];
  label: string;
  onReorder: (ids: string[]) => void;
  renderItem: (item: SortableItem, index: number) => React.ReactNode;
}) {
  const dndId = useId();
  const { announcements, instructions } = useSortableAnnouncements(items);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: POINTER_DISTANCE } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: TOUCH_DELAY_MS, tolerance: POINTER_DISTANCE },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    const ids = items.map((item) => item.id);
    const [from, to] = [ids.indexOf(String(active.id)), ids.indexOf(String(over?.id))];

    if (from !== -1 && to !== -1 && from !== to) {
      onReorder(arrayMove(ids, from, to));
    }
  }

  return (
    <DndContext
      accessibility={{ announcements, screenReaderInstructions: instructions }}
      collisionDetection={closestCenter}
      id={dndId}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ol aria-label={label} className="flex flex-col gap-2" data-slot="activity-sortable-list">
          {items.map((item, index) => (
            <SortableRow disabled={disabled} id={item.id} key={item.id} label={item.label}>
              {renderItem(item, index)}
            </SortableRow>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

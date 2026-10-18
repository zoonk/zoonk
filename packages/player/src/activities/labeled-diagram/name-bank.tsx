"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { GripVertical } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef } from "react";
import { useActivityDraggable } from "../_components/activity-drag-drop";

const CHIP_CLASS =
  "flex min-h-11 items-center gap-1.5 rounded-full border bg-background ps-2.5 pe-3.5 text-sm font-medium";

/** How a name looks, lifted and tilted while it's dragged. */
function NameChipFace({ isLifted, name }: { isLifted: boolean; name: string }) {
  return (
    <span className={cn(CHIP_CLASS, isLifted && "-rotate-3 shadow-lg")}>
      <GripVertical aria-hidden="true" className="text-muted-foreground size-4" />
      {name}
    </span>
  );
}

/**
 * A name to place. Tapping (or Enter) puts it on the highlighted spot; dragging drops it on any
 * spot or pin. The drag is a pointer shortcut only, so its keyboard hints are left out.
 */
function NameChip({
  activeNumber,
  name,
  onPlace,
}: {
  activeNumber: number | null;
  name: string;
  onPlace: () => void;
}) {
  const t = useExtracted();

  const { dragProps, isClickAfterDrag, isDragging } = useActivityDraggable({ id: name });
  const isDisabled = activeNumber === null;

  return (
    <button
      {...dragProps}
      aria-disabled={isDisabled}
      aria-label={
        isDisabled ? name : t("Put {name} on spot {number}", { name, number: String(activeNumber) })
      }
      className={cn(
        "focus-visible:ring-ring/50 touch-manipulation rounded-full outline-none focus-visible:ring-[3px]",
        isDisabled ? "opacity-60" : "hover:[&>span]:bg-accent cursor-grab active:cursor-grabbing",
        isDragging && "relative z-10",
      )}
      onClick={() => {
        if (!isDisabled && !isClickAfterDrag()) {
          onPlace();
        }
      }}
      type="button"
    >
      <NameChipFace isLifted={isDragging} name={name} />
    </button>
  );
}

/** The names not placed yet, with what tapping one does right now. */
export function NameBank({
  activeNumber,
  names,
  onPlace,
}: {
  activeNumber: number | null;
  names: readonly string[];
  onPlace: (name: string) => void;
}) {
  const t = useExtracted();
  const listRef = useRef<HTMLUListElement>(null);

  if (names.length === 0) {
    return null;
  }

  /**
   * Keyboard users keep their place: focus moves to the chip after the placed one (or before it,
   * for the last one) right away, before the placed chip leaves the list.
   */
  function place(name: string, index: number) {
    const chips = listRef.current?.querySelectorAll("button");
    const hadFocus = listRef.current?.contains(document.activeElement) ?? false;

    if (hadFocus) {
      (chips?.[index + 1] ?? chips?.[index - 1])?.focus();
    }

    onPlace(name);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs">
        {activeNumber === null
          ? t("Every spot has a name. Tap a spot to change it.")
          : t("Tap a name for spot {number}, or drag it onto any spot.", {
              number: String(activeNumber),
            })}
      </p>

      <ul aria-label={t("Names")} className="flex flex-wrap gap-2" ref={listRef}>
        {names.map((name, index) => (
          <li key={name}>
            <NameChip activeNumber={activeNumber} name={name} onPlace={() => place(name, index)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

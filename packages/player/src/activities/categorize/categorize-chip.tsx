"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { Check, X } from "lucide-react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { useActivityDraggable } from "../_components/activity-drag-drop";

export type ChipResult = "correct" | "incorrect" | null;

export function CategorizeChip({
  disabled,
  dragId,
  id,
  isSelected,
  label,
  onSelect,
  result,
  text,
}: {
  disabled: boolean;
  dragId: string;
  id: string;
  isSelected: boolean;
  label: string;
  onSelect: () => void;
  result: ChipResult;
  text: string;
}) {
  const { dragProps, isClickAfterDrag, isDragging } = useActivityDraggable({
    disabled,
    id: dragId,
  });

  return (
    <button
      {...dragProps}
      aria-label={label}
      aria-pressed={disabled ? undefined : isSelected}
      className={cn(
        "bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-11 w-full touch-manipulation items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm leading-snug outline-none focus-visible:ring-[3px]",
        !disabled && "hover:bg-accent cursor-grab active:cursor-grabbing",
        isSelected && "border-primary ring-primary/15 font-medium ring-[3px]",
        isDragging && "relative z-20 shadow-lg",
        result === "correct" && "border-success/60 bg-success/10",
        result === "incorrect" && "border-destructive bg-destructive/10 border-2 font-medium",
      )}
      data-slot="categorize-chip"
      disabled={disabled}
      id={id}
      onClick={() => {
        if (!isClickAfterDrag()) {
          onSelect();
        }
      }}
      type="button"
    >
      <span className="min-w-0 flex-1">
        <LessonRichText text={text} />
      </span>

      {result === "correct" && (
        <Check aria-hidden="true" className="text-success-text size-4 shrink-0" />
      )}
      {result === "incorrect" && (
        <X aria-hidden="true" className="text-destructive-text size-4 shrink-0" />
      )}
    </button>
  );
}

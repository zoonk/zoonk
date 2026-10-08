"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { Check, X } from "lucide-react";

/**
 * A grid of things to tap: spans on a chart, a next move, cells to pick. Each item is a toggle
 * button (`aria-pressed`), so it works with a keyboard and says whether it's picked.
 */
export function ActivitySelectGrid({
  className,
  columns = 2,
  label,
  ...props
}: React.ComponentProps<"div"> & { columns?: 1 | 2 | 3; label: string }) {
  return (
    <div
      aria-label={label}
      className={cn(
        "grid gap-2",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-3",
        className,
      )}
      data-slot="activity-select-grid"
      role="group"
      {...props}
    />
  );
}

type SelectState = "correct" | "incorrect" | null;

export function ActivitySelectGridItem({
  children,
  className,
  disabled,
  isSelected,
  onToggle,
  resultState = null,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  isSelected: boolean;
  onToggle: () => void;
  resultState?: SelectState;
}) {
  return (
    <button
      aria-pressed={isSelected}
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border px-3 py-2 text-center text-sm tabular-nums transition-colors outline-none focus-visible:ring-[3px]",
        !resultState && !isSelected && "border-border hover:bg-accent",
        !resultState && isSelected && "border-primary bg-primary/5 font-medium",
        resultState === "correct" && "border-success/60 bg-success/10 text-success font-medium",
        resultState === "incorrect" && "border-destructive/60 bg-destructive/10 text-destructive",
        disabled && "pointer-events-none",
        className,
      )}
      data-slot="activity-select-grid-item"
      disabled={disabled}
      onClick={onToggle}
      type="button"
    >
      {/* The mark sits on the label's first line when a long label wraps. */}
      <span className="flex items-start gap-1.5">
        {resultState && (
          <LineMarker>
            {resultState === "correct" ? (
              <Check aria-hidden="true" className="size-4" />
            ) : (
              <X aria-hidden="true" className="size-4" />
            )}
          </LineMarker>
        )}
        <span className="min-w-0">{children}</span>
      </span>
    </button>
  );
}

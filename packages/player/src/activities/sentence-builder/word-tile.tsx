"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { keepArrowKeys } from "../_utils/keep-arrow-keys";

export type WordTileState = "correct" | "idle" | "placeholder" | "wrong";

/**
 * A word to tap: in the bank it adds the word, in the sentence it takes it back out. A used
 * bank tile stays as an empty slot so the others don't move.
 */
export function WordTile({
  children,
  disabled,
  label,
  onClick,
  state = "idle",
}: {
  children: string;
  disabled?: boolean;
  label?: string;
  onClick?: () => void;
  state?: WordTileState;
}) {
  if (state === "placeholder") {
    return (
      <span
        aria-hidden="true"
        className="bg-muted flex h-11 items-center rounded-xl px-3.5 text-base text-transparent"
      >
        {children}
      </span>
    );
  }

  return (
    <button
      aria-label={label}
      className={cn(
        "flex h-11 min-w-11 items-center justify-center rounded-xl border px-3.5 text-base font-medium outline-none",
        "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "motion-safe:transition-transform motion-safe:active:translate-y-px",
        state === "idle" && "border-border bg-background shadow-[0_2px_0_var(--color-border)]",
        state === "correct" && "border-success/60 bg-success/10 text-success",
        state === "wrong" && "border-destructive/60 bg-destructive/10 text-destructive border-2",
        disabled && "pointer-events-none",
      )}
      disabled={disabled}
      onClick={onClick}
      onKeyDown={keepArrowKeys}
      type="button"
    >
      {children}
    </button>
  );
}

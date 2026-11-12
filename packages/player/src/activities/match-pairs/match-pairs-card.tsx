"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { Check, X } from "lucide-react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ACTIVITY_CARD_CLASS, ACTIVITY_PRESS_CLASS } from "../_components/activity-canvas";

export type MatchCardState = "idle" | "matched" | "missed" | "noMatch" | "selected";

export function MatchPairsCard({
  isDisabled,
  label,
  lang,
  onPick,
  state,
  text,
}: {
  isDisabled: boolean;
  label: string;
  lang?: string;
  onPick: () => void;
  state: MatchCardState;
  text: string;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={state === "matched" || state === "noMatch" ? undefined : state === "selected"}
      className={cn(
        ACTIVITY_CARD_CLASS,
        ACTIVITY_PRESS_CLASS,
        "focus-visible:border-ring flex min-h-12 w-full items-center gap-2 leading-snug font-medium",
        state === "idle" && "hover:bg-accent",
        state === "selected" && "border-primary ring-primary/15 ring-[3px]",
        state === "matched" && "border-success/40 bg-success/10 text-success-text",
        state === "missed" &&
          "border-destructive bg-destructive/10 motion-safe:animate-shake border-2",
        state === "noMatch" && "text-muted-foreground border-dashed bg-transparent",
      )}
      data-slot="match-pairs-card"
      disabled={isDisabled}
      lang={lang}
      onClick={onPick}
      type="button"
    >
      <span className="min-w-0 flex-1 wrap-break-word">
        <LessonRichText text={text} />
      </span>

      {state === "matched" && <Check aria-hidden="true" className="size-4 shrink-0" />}
      {state === "missed" && (
        <X aria-hidden="true" className="text-destructive-text size-4 shrink-0" />
      )}
    </button>
  );
}

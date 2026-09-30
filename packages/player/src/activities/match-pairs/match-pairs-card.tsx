"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { Check, X } from "lucide-react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";

export type MatchCardState = "idle" | "matched" | "missed" | "selected";

/** A card in one of the two columns: pick one on each side to try a match. */
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
      aria-pressed={state === "matched" ? undefined : state === "selected"}
      className={cn(
        "bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-12 w-full items-center gap-2 rounded-2xl border px-3.5 py-2 text-left text-sm leading-snug font-medium outline-none focus-visible:ring-[3px] sm:text-base",
        state === "idle" && "hover:bg-accent",
        state === "selected" && "border-primary ring-primary/15 ring-[3px]",
        state === "matched" && "border-success/40 bg-success/10 text-success",
        state === "missed" &&
          "border-destructive bg-destructive/10 motion-safe:animate-shake border-2",
      )}
      data-slot="match-pairs-card"
      disabled={isDisabled}
      lang={lang}
      onClick={onPick}
      type="button"
    >
      <span className="min-w-0 flex-1">
        <LessonRichText text={text} />
      </span>

      {state === "matched" && <Check aria-hidden="true" className="size-4 shrink-0" />}
      {state === "missed" && <X aria-hidden="true" className="text-destructive size-4 shrink-0" />}
    </button>
  );
}

"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { Check, GripVertical, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { useActivityDraggable, useActivityDropTarget } from "../_components/activity-drag-drop";

export type ArgumentPart = "evidence" | "reasoning";

/** A candidate's text: a quote with its citation, or a line of reasoning. */
export function ArgumentText({ citation, text }: { citation?: string; text: string }) {
  if (citation === undefined) {
    return (
      <span className="text-sm leading-snug sm:text-base">
        <LessonRichText text={text} />
      </span>
    );
  }

  return (
    <span className="flex flex-col gap-1">
      <q className="font-serif text-[15px] leading-snug sm:text-base">
        <LessonRichText text={text} />
      </q>
      <span className="text-muted-foreground text-xs">{citation}</span>
    </span>
  );
}

/** Why a pick is strong or weak, shown after the check. */
export function ArgumentWhy({ text }: { text: string }) {
  return (
    <p className="text-muted-foreground text-sm leading-snug">
      <LessonRichText text={text} />
    </p>
  );
}

/**
 * A candidate to build the argument with. Tapping it puts it in the open part; pointers can drag
 * it there too.
 */
export function ArgumentCandidate({
  citation,
  disabled,
  id,
  label,
  onChoose,
  text,
}: {
  citation?: string;
  disabled: boolean;
  id: string;
  label: string;
  onChoose: () => void;
  text: string;
}) {
  const { dragProps, isClickAfterDrag, isDragging } = useActivityDraggable({ disabled, id });

  return (
    <button
      {...dragProps}
      aria-label={label}
      className={cn(
        "bg-background focus-visible:border-ring focus-visible:ring-ring/50 hover:bg-accent flex min-h-11 w-full touch-manipulation items-start gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left outline-none focus-visible:ring-[3px]",
        !disabled && "cursor-grab active:cursor-grabbing",
        isDragging && "relative z-20 shadow-lg",
      )}
      data-slot="argument-candidate"
      disabled={disabled}
      onClick={() => {
        if (!isClickAfterDrag()) {
          onChoose();
        }
      }}
      type="button"
    >
      <GripVertical aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <ArgumentText citation={citation} text={text} />
    </button>
  );
}

type SlotResult = "strong" | "weak" | null;

/**
 * One part of the argument (evidence or reasoning): empty and waiting, open for the next pick, or
 * filled with a way to take the pick back out. After the check it says whether the pick is strong.
 */
export function ArgumentSlot({
  children,
  clearLabel,
  hint,
  isOpen,
  label,
  onClear,
  part,
  result,
}: {
  children?: React.ReactNode;
  clearLabel: string;
  hint: string;
  isOpen: boolean;
  label: string;
  onClear?: () => void;
  part: ArgumentPart;
  result: SlotResult;
}) {
  const t = useExtracted();
  const { dropRef, isOver } = useActivityDropTarget({ disabled: !isOpen, id: part });
  const isFilled = children !== undefined;

  return (
    <section
      aria-label={label}
      className={cn(
        "flex flex-col gap-1.5 rounded-2xl border-2 border-dashed px-3.5 py-2.5",
        isOpen && "border-viz-accent/60 bg-viz-accent-soft/40",
        isOver && "border-viz-accent bg-viz-accent-soft",
        isFilled && "bg-background border-solid",
        result === "strong" && "border-success bg-success/10",
        result === "weak" && "border-destructive bg-destructive/10",
      )}
      data-slot="argument-slot"
      ref={dropRef}
    >
      <div className="flex min-h-6 items-center justify-between gap-2">
        <p
          className={cn(
            "text-xs font-semibold",
            isOpen || isFilled ? "text-viz-accent" : "text-muted-foreground",
          )}
        >
          {label}
        </p>

        {result === "strong" && (
          <span className="text-success flex items-center gap-1 text-xs font-semibold">
            <Check aria-hidden="true" className="size-3.5" />
            {t("Strong")}
          </span>
        )}

        {result === "weak" && (
          <span className="text-destructive flex items-center gap-1 text-xs font-semibold">
            <X aria-hidden="true" className="size-3.5" />
            {t("Weak")}
          </span>
        )}

        {onClear && (
          <button
            aria-label={clearLabel}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -my-2 -mr-2 flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-[3px]"
            onClick={onClear}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>

      {children ?? <p className="text-muted-foreground text-sm">{hint}</p>}
    </section>
  );
}

"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { Check, GripVertical, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import {
  ACTIVITY_CARD_CLASS,
  ACTIVITY_EMPTY_CLASS,
  ACTIVITY_PRESS_CLASS,
} from "../_components/activity-canvas";
import { useActivityDraggable, useActivityDropTarget } from "../_components/activity-drag-drop";
import { ACTIVITY_COLOR } from "../_utils/activity-colors";

export type ArgumentPart = "evidence" | "reasoning";

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
      <q className="text-reading leading-snug sm:text-base">
        <LessonRichText text={text} />
      </q>
      <span className="text-muted-foreground text-xs">{citation}</span>
    </span>
  );
}

export function ArgumentWhy({ text }: { text: string }) {
  return (
    <p className="text-muted-foreground text-sm leading-snug">
      <LessonRichText text={text} />
    </p>
  );
}

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
        ACTIVITY_CARD_CLASS,
        ACTIVITY_PRESS_CLASS,
        "focus-visible:border-ring hover:bg-accent flex w-full touch-manipulation items-start gap-2.5",
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

/** A slot's name takes the slot's color: the data hue while it's worked on, its verdict once checked. */
function labelColor({ isActive, result }: { isActive: boolean; result: SlotResult }): string {
  if (result === "strong") {
    return ACTIVITY_COLOR.right.text;
  }

  if (result === "weak") {
    return ACTIVITY_COLOR.wrong.text;
  }

  return isActive ? ACTIVITY_COLOR.data.text : ACTIVITY_COLOR.guess.text;
}

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
        ACTIVITY_CARD_CLASS,
        ACTIVITY_EMPTY_CLASS,
        "flex flex-col gap-1.5",
        isOpen && "border-viz-accent/60 bg-viz-accent-soft/40",
        isOver && "border-viz-accent bg-viz-accent-soft",
        isFilled && "bg-background border-solid",
        result === "strong" && cn("border-success", ACTIVITY_COLOR.right.soft),
        result === "weak" && cn("border-destructive", ACTIVITY_COLOR.wrong.soft),
      )}
      data-slot="argument-slot"
      ref={dropRef}
    >
      <div className="flex min-h-6 items-center justify-between gap-2">
        <p
          className={cn(
            "text-xs font-semibold",
            labelColor({ isActive: isOpen || isFilled, result }),
          )}
        >
          {label}
        </p>

        {result === "strong" && (
          <span
            className={cn(
              ACTIVITY_COLOR.right.text,
              "flex items-center gap-1 text-xs font-semibold",
            )}
          >
            <Check aria-hidden="true" className="size-3.5" />
            {t("Strong")}
          </span>
        )}

        {result === "weak" && (
          <span
            className={cn(
              ACTIVITY_COLOR.wrong.text,
              "flex items-center gap-1 text-xs font-semibold",
            )}
          >
            <X aria-hidden="true" className="size-3.5" />
            {t("Weak")}
          </span>
        )}

        {onClear && (
          <Button
            aria-label={clearLabel}
            className="text-muted-foreground -my-1.5"
            edge="end"
            onClick={onClear}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </div>

      {children ?? <p className="text-muted-foreground text-sm">{hint}</p>}
    </section>
  );
}

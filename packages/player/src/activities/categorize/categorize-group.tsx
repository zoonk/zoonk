"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { useActivityDropTarget } from "../_components/activity-drag-drop";

type Group = { id: string; label: string; rule: string };

export function CategorizeGroup({
  children,
  group,
  isEmpty,
  onPlace,
  selectedText,
}: {
  children: React.ReactNode;
  group: Group;
  isEmpty: boolean;
  onPlace: () => void;
  selectedText: string | null;
}) {
  const t = useExtracted();
  const headingId = useId();
  const { dropRef, isOver } = useActivityDropTarget({ id: group.id });
  const canPlace = selectedText !== null;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "bg-muted/70 relative flex flex-col gap-2 rounded-2xl p-2.5 transition-shadow motion-reduce:transition-none",
        canPlace && "ring-viz-accent/40 ring-2",
        isOver && "ring-viz-accent ring-2",
      )}
      data-slot="categorize-group"
      ref={dropRef}
    >
      <button
        aria-label={
          selectedText === null
            ? undefined
            : t("Put {item} in {group}", { group: group.label, item: selectedText })
        }
        className={cn(
          "focus-visible:ring-ring/50 flex min-h-11 flex-col items-start rounded-xl px-1.5 pt-1 pb-1.5 text-left outline-none focus-visible:ring-[3px]",
          canPlace &&
            "hover:bg-viz-accent-soft cursor-pointer after:absolute after:inset-0 after:rounded-2xl after:content-['']",
        )}
        aria-disabled={!canPlace}
        onClick={() => canPlace && onPlace()}
        type="button"
      >
        <span className="text-base font-semibold" id={headingId}>
          <LessonRichText text={group.label} />
        </span>

        <span className="text-muted-foreground text-xs leading-snug">
          <LessonRichText text={group.rule} />
        </span>
      </button>

      <div className="relative z-10 flex flex-col gap-2 empty:hidden">{children}</div>

      {isEmpty && (
        <p
          aria-hidden="true"
          className={cn(
            "text-muted-foreground flex min-h-11 items-center justify-center rounded-xl border border-dashed px-3 text-center text-xs",
            canPlace && "border-viz-accent/60 text-viz-accent",
          )}
        >
          {canPlace ? t("Put it here") : t("Nothing here yet")}
        </p>
      )}
    </section>
  );
}

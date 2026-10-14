"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { LIST_GROUP_CLASS } from "../_components/list-group";
import { DoneMark } from "../_components/status-mark";

/**
 * A few things to get across, flat on the page with a hairline between them: a call's goals
 * before, during and after it, and what a unit lets the learner do ("I can…"). One look for all
 * of them, so a goal reads the same on the intro, in the call and on the result.
 *
 * ```tsx
 * <ChecklistRows aria-label="Goals of the call">
 *   <ChecklistRow done description="Say when you can visit">Book a viewing</ChecklistRow>
 *   <ChecklistRow done={false}>Ask about the deposit</ChecklistRow>
 * </ChecklistRows>
 * ```
 */
export function ChecklistRows({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn(LIST_GROUP_CLASS, "w-full text-left", className)}
      data-slot="checklist-rows"
      {...props}
    />
  );
}

/**
 * One thing to get across: an 8px ring while it's still ahead, the done mark every list shares once
 * it's done, on the first line of its words however many lines they wrap to. Screen readers hear
 * "done" or "not yet" after it.
 */
export function ChecklistRow({
  children,
  className,
  description,
  done,
  lang,
}: {
  children: React.ReactNode;
  className?: string;
  /** One quiet line under it: why, or how. */
  description?: React.ReactNode;
  done: boolean;
  /** The language its words are in, when it isn't the screen's (a call's goals). */
  lang?: string;
}) {
  const t = useExtracted();

  return (
    <li
      className={cn("flex items-start gap-3 py-2.5 text-sm leading-snug", className)}
      data-slot="checklist-row"
    >
      <LineMarker aria-hidden="true">
        <span className="flex size-4 items-center justify-center">
          {done ? (
            <DoneMark />
          ) : (
            <span className="border-foreground/30 size-2 rounded-full border-[1.5px]" />
          )}
        </span>
      </LineMarker>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-pretty">
          <span lang={lang}>{children}</span>
          <span className="sr-only">{done ? t(", done") : t(", not yet")}</span>
        </span>
        {description && (
          <span className="text-muted-foreground text-xs leading-snug text-pretty">
            {description}
          </span>
        )}
      </span>
    </li>
  );
}

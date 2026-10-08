"use client";

import { ProgressIndicator, ProgressRoot, ProgressTrack } from "@zoonk/ui/components/progress";
import { cn } from "@zoonk/ui/lib/utils";
import { useLocale } from "next-intl";

/**
 * The header of every full-screen task (a lesson, a block of questions, a practice, a test-out, a
 * checkpoint, a mock): close on the left, the task's title centered with one quiet line under it
 * (its minutes, or "1 of 3"), the "…" menu on the right and one thin bar for how far into the task
 * the learner is. The sides take the same room, so the title stays centered.
 */
export function TaskHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("shrink-0", className)} data-slot="task-header" {...props} />;
}

/** The header's row: close, the title and the menu, in that order. */
export function TaskHeaderBar({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn("flex items-center gap-2 px-3 py-2 sm:px-4 xl:py-3", className)}
      {...props}
    />
  );
}

/** A side of the row (close or the menu), as wide as the other one so the title stays centered. */
export function TaskHeaderSide({
  align,
  children,
}: {
  align: "end" | "start";
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-9 flex-1 basis-0",
        align === "end" ? "justify-end" : "justify-start",
      )}
    >
      {children}
    </div>
  );
}

/**
 * The task's name is the page's heading. It's never cut: a long one balances over two lines, with
 * the quiet line (`detail`) under it.
 */
export function TaskHeaderTitle({ detail, title }: { detail: React.ReactNode; title: string }) {
  return (
    <div className="flex min-w-0 shrink flex-col items-center text-center text-balance">
      <h1 className="text-foreground text-sm leading-5 font-medium">{title}</h1>
      <p aria-live="polite" className="text-muted-foreground text-xs leading-4 tabular-nums">
        {detail}
      </p>
    </div>
  );
}

/** One thin bar under the header for the task in view, never the whole session. */
export function TaskHeaderProgress({ label, value }: { label: string; value: number }) {
  const locale = useLocale();

  return (
    <ProgressRoot
      aria-label={label}
      className="gap-0"
      data-slot="task-header-progress"
      locale={locale}
      value={Math.min(100, Math.max(0, value))}
    >
      <ProgressTrack className="h-1 rounded-none">
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressRoot>
  );
}

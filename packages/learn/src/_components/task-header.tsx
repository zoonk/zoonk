"use client";

import { ProgressIndicator, ProgressRoot, ProgressTrack } from "@zoonk/ui/components/progress";
import { useScrolled } from "@zoonk/ui/hooks/scrolled";
import { cn } from "@zoonk/ui/lib/utils";
import { useLocale } from "next-intl";
import { useSyncExternalStore } from "react";
import { TASK_COLUMN_CLASS, TASK_HEADER_BAR_CLASS, TASK_HEADER_SIDE_CLASS } from "./task-layout";

/**
 * The header of every full-screen task (a lesson, a block of questions, a practice, a test-out, a
 * checkpoint, a mock): close in the window's top-left corner, the task's title centered over its
 * column, the "…" menu in the top-right corner (from `lg`, beside the aside when there is one)
 * and, under the title, how far into the task the learner is. The sides take the same room, so the
 * title stays centered. What scrolls under it fades out at its edge rather than being cut off, and
 * once the page scrolls it draws its hairline across the task's room, as the app's bars do.
 */
export function TaskHeader({ className, ...props }: React.ComponentProps<"div">) {
  const scrolled = useScrolled();

  return (
    <div
      className={cn(
        "after:from-background relative z-30 shrink-0 border-b transition-colors after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:mt-px after:h-3 after:bg-linear-to-b after:to-transparent motion-reduce:transition-none",
        scrolled ? "border-border" : "border-transparent",
        className,
      )}
      data-slot="task-header"
      {...props}
    />
  );
}

/**
 * The header's row: close, the title and the menu, in that order, across the task's room at every
 * size, so the close and the menu sit in its corners like any full-screen app's, while the title
 * centers over the task's column (`TASK_HEADER_BAR_CLASS`). From `lg` a task's aside runs beside
 * it, its own header row level with this one (`TaskAside`).
 */
export function TaskHeaderBar({ className, ...props }: React.ComponentProps<"header">) {
  return <header className={cn(TASK_HEADER_BAR_CLASS, className)} {...props} />;
}

/** A side of the row: close (`start`) or the menu (`end`), see `TASK_HEADER_SIDE_CLASS`. */
export function TaskHeaderSide({
  align,
  children,
}: {
  align: "end" | "start";
  children?: React.ReactNode;
}) {
  return <div className={TASK_HEADER_SIDE_CLASS[align]}>{children}</div>;
}

/**
 * The header's ghost icon buttons (close on the left, the "…" menu on the right) reach past the
 * row's padding by their own, so their glyphs sit on a phone's text edge, as the content under them
 * does, and evenly in the window's corners on a wider screen.
 */
export const TASK_HEADER_ICON_CLASS = { end: "-mr-2.5", start: "-ml-2.5" } as const;

/**
 * The task's name is the page's heading. It's never cut: a long one balances over two lines. How
 * far the learner is shows in the bar under the header, so the title stands alone; only a task
 * that runs on a clock (a call) keeps a quiet line (`detail`) under it.
 */
export function TaskHeaderTitle({
  announce = true,
  detail,
  title,
}: {
  /**
   * Whether screen readers hear the quiet line when it changes; off for a line that changes on its
   * own, like a call's clock every second.
   */
  announce?: boolean;
  detail?: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex min-w-0 shrink flex-col items-center text-center text-balance">
      <h1 className="text-foreground text-sm leading-5 font-medium">{title}</h1>
      {detail && (
        <p
          aria-live={announce ? "polite" : undefined}
          className="text-muted-foreground font-mono text-[0.6875rem] leading-4 tabular-nums"
        >
          {detail}
        </p>
      )}
    </div>
  );
}

/**
 * How far into the task in view the learner is, never the whole session: one 4px bar under the
 * header, in the task's column, for a task told as one run (a mock's questions, a test-out).
 */
export function TaskHeaderProgress({ label, value }: { label: string; value: number }) {
  const locale = useLocale();

  return (
    <ProgressRoot
      aria-label={label}
      className={cn(TASK_COLUMN_CLASS, "gap-0 pb-1")}
      data-slot="task-header-progress"
      locale={locale}
      value={Math.min(100, Math.max(0, value))}
    >
      <ProgressTrack className="bg-surface-3 h-1 rounded-xs">
        <ProgressIndicator className="bg-foreground rounded-xs" />
      </ProgressTrack>
    </ProgressRoot>
  );
}

/**
 * Where a screen stands in a task told screen by screen: still ahead, the one in view, read, done
 * (a step of the day finished), or answered right or wrong the first time.
 */
export type TaskSegment = "ahead" | "current" | "done" | "read" | "right" | "wrong";

/** From this many screens, the segments sit a hairline apart so each keeps some width on phones. */
const DENSE_SEGMENTS = 40;

/**
 * Only answers carry color, so blue and red stand out: a read screen is a quiet gray, the one in
 * view is half filled on the track, and what's ahead is the bare track.
 */
const SEGMENT_CLASS: Record<TaskSegment, string> = {
  ahead: "bg-surface-3",
  current: "bg-surface-3",
  done: "bg-success",
  read: "bg-foreground/25",
  right: "bg-success",
  wrong: "bg-destructive",
};

/**
 * The task's progress as one short segment per screen, under the header and as wide as the task's
 * column: read screens fill in quietly, answers fill blue when right and red when wrong, so the
 * learner sees how it's going at a glance. Segments share the width evenly, or by `weights` (the
 * day's blocks by their minutes, as Today draws them). Still one progress bar for screen readers
 * (`label`, `value` in percent).
 */
export function TaskHeaderSegments({
  label,
  segments,
  value,
  weights,
}: {
  label: string;
  segments: readonly TaskSegment[];
  value: number;
  /** Each segment's share of the width, in the same order; even without them. */
  weights?: readonly number[];
}) {
  const locale = useLocale();

  return (
    <ProgressRoot
      aria-label={label}
      className={cn(TASK_COLUMN_CLASS, "pb-1")}
      data-slot="task-header-segments"
      locale={locale}
      value={Math.min(100, Math.max(0, value))}
    >
      <span
        aria-hidden="true"
        className={cn("flex h-1 w-full", segments.length > DENSE_SEGMENTS ? "gap-px" : "gap-[3px]")}
      >
        {segments.map((segment, index) => (
          <span
            className={cn(
              "flex min-w-0 flex-1 overflow-hidden rounded-xs transition-colors motion-reduce:transition-none",
              SEGMENT_CLASS[segment],
            )}
            data-segment={segment}
            // oxlint-disable-next-line react/no-array-index-key -- Segments are positions, not items.
            key={index}
            style={weights ? { flexGrow: Math.max(1, weights[index] ?? 1) } : undefined}
          >
            {segment === "current" && <span className="bg-foreground/50 w-1/2" />}
          </span>
        ))}
      </span>
    </ProgressRoot>
  );
}

/** Where a task's aside shows (`TaskAside`): Tailwind's `lg`. */
const ASIDE_QUERY = "(min-width: 64rem)";

function subscribeToAsideQuery(onChange: () => void) {
  const query = globalThis.matchMedia(ASIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Whether the screen is wide enough for the task's aside, for what has to behave differently
 * there, not just look different (the buddy docked in the aside instead of a drawer). Layout stays
 * in CSS: this is false on the server and while hydrating. It lives with the header, the task
 * chrome's client module.
 */
export function useTaskAsideShown(): boolean {
  return useSyncExternalStore(
    subscribeToAsideQuery,
    () => globalThis.matchMedia(ASIDE_QUERY).matches,
    () => false,
  );
}

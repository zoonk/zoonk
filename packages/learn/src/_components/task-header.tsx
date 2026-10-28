"use client";

import { ProgressIndicator, ProgressRoot, ProgressTrack } from "@zoonk/ui/components/progress";
import { useScrolled } from "@zoonk/ui/hooks/scrolled";
import { cn } from "@zoonk/ui/lib/utils";
import { useLocale } from "next-intl";
import { useSyncExternalStore } from "react";
import { TASK_COLUMN_CLASS, TASK_HEADER_BAR_CLASS, TASK_HEADER_SIDE_CLASS } from "./task-layout";

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

export function TaskHeaderBar({ className, ...props }: React.ComponentProps<"header">) {
  return <header className={cn(TASK_HEADER_BAR_CLASS, className)} {...props} />;
}

export function TaskHeaderSide({
  align,
  children,
}: {
  align: "end" | "start";
  children?: React.ReactNode;
}) {
  return <div className={TASK_HEADER_SIDE_CLASS[align]}>{children}</div>;
}

export const TASK_HEADER_ICON_CLASS = { end: "-mr-2.5", start: "-ml-2.5" } as const;

export function TaskHeaderTitle({
  announce = true,
  detail,
  title,
}: {
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

export type TaskSegment = "ahead" | "current" | "done" | "read" | "right" | "wrong";

const DENSE_SEGMENTS = 40;

const SEGMENT_CLASS: Record<TaskSegment, string> = {
  ahead: "bg-surface-3",
  current: "ring-success ring-1 ring-inset",
  done: "bg-success",
  read: "bg-foreground/25",
  right: "bg-success",
  wrong: "bg-destructive",
};

export function TaskHeaderSegments({
  label,
  segments,
  value,
  weights,
}: {
  label: string;
  segments: readonly TaskSegment[];
  value: number;
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
          />
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

/** False on the server and while hydrating, so layout stays in CSS; use it only for behavior. */
export function useTaskAsideShown(): boolean {
  return useSyncExternalStore(
    subscribeToAsideQuery,
    () => globalThis.matchMedia(ASIDE_QUERY).matches,
    () => false,
  );
}

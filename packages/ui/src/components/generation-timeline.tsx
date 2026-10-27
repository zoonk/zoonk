"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { ProgressRoot, type ProgressRootProps, ProgressValue } from "@zoonk/ui/components/progress";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, CircleAlertIcon } from "lucide-react";
import { getSegmentFills } from "./_utils/segment-fills";

type GenerationTimelineStepStatus = "active" | "completed" | "failed" | "pending";

/**
 * A wait for generated content: a header with the progress bar, then one flat row per phase. It
 * holds no copy; callers pass every label. `data-paused` on it (a lost connection) stops the rows'
 * working animations while their statuses stay as they were.
 */
function GenerationTimeline({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("group/generation-timeline flex w-full flex-col gap-6", className)}
      data-slot="generation-timeline"
      {...props}
    />
  );
}

function GenerationTimelineHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-3", className)}
      data-slot="generation-timeline-header"
      {...props}
    />
  );
}

/**
 * The wait is usually the page's main content, so its title is the page's heading, sized as every
 * page's; a wait inside a screen that has its own (`render`, such as `<h2 />`) takes the next level.
 */
function GenerationTimelineTitle({ className, render, ...props }: useRender.ComponentProps<"h1">) {
  return useRender({
    defaultTagName: "h1",
    props: mergeProps<"h1">({ className: cn("text-title wrap-break-word", className) }, props),
    render,
    state: { slot: "generation-timeline-title" },
  });
}

function GenerationTimelineDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-sm text-pretty", className)}
      data-slot="generation-timeline-description"
      {...props}
    />
  );
}

/**
 * The bar with its percentage: one segment per phase, as wide as the phase usually takes
 * (`weights`), so the segments fill in step with the percentage. The ones done are blue, the one
 * running fills as it goes, the rest wait on the track. `aria-label` names what is being made;
 * pass `locale` so the server and the browser format the percentage the same way.
 */
function GenerationTimelineProgress({
  className,
  value,
  weights,
  ...props
}: ProgressRootProps & { "aria-label": string; weights: readonly number[] }) {
  const fills = getSegmentFills({ value: value ?? 0, weights });

  return (
    <ProgressRoot
      className={cn("flex-nowrap items-center gap-3", className)}
      data-slot="generation-timeline-progress"
      value={value}
      {...props}
    >
      <span aria-hidden="true" className="flex h-1 min-w-0 flex-1 gap-[3px]">
        {fills.map((fill, index) => (
          <span
            className="bg-surface-3 flex min-w-0 overflow-hidden rounded-xs"
            data-slot="generation-timeline-segment"
            // oxlint-disable-next-line react/no-array-index-key -- Segments are positions, not items.
            key={index}
            style={{ flexGrow: Math.max(1, weights[index] ?? 1) }}
          >
            <span
              className="bg-success h-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{ width: `${fill * 100}%` }}
            />
          </span>
        ))}
      </span>

      <ProgressValue className="text-muted-foreground ml-0 min-w-[4ch] text-right font-mono text-xs tabular-nums" />
    </ProgressRoot>
  );
}

/**
 * Says the current phase to screen readers when it changes (a polite, visually hidden status), so
 * they hear each phase once instead of every percent or detail line.
 */
function GenerationTimelineStatus({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("sr-only", className)}
      data-slot="generation-timeline-status"
      role="status"
      {...props}
    />
  );
}

function GenerationTimelineSteps({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      className={cn("flex flex-col gap-2.5", className)}
      data-slot="generation-timeline-steps"
      {...props}
    />
  );
}

/**
 * One phase as a flat row: its mark, its label and, while it runs, a detail line under it, with its
 * time at the end when the row has one.
 */
function GenerationTimelineStep({
  className,
  status,
  ...props
}: React.ComponentProps<"li"> & { status: GenerationTimelineStepStatus }) {
  return (
    <li
      aria-current={status === "active" ? "step" : undefined}
      className={cn(
        "group/generation-timeline-step grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 has-data-[slot=generation-timeline-step-time]:grid-cols-[1rem_minmax(0,1fr)_auto]",
        className,
      )}
      data-slot="generation-timeline-step"
      data-status={status}
      {...props}
    />
  );
}

/**
 * A quiet ring while the phase waits, a dot in the text color while it runs, a faint check once
 * done and an alert where it stopped. Level with the label's first line.
 */
function GenerationTimelineStepIndicator({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("row-span-2 flex h-5 items-center justify-center", className)}
      data-slot="generation-timeline-step-indicator"
      {...props}
    >
      <span className="ring-faint size-2 rounded-full ring-1 group-data-[status=active]/generation-timeline-step:hidden group-data-[status=completed]/generation-timeline-step:hidden group-data-[status=failed]/generation-timeline-step:hidden" />
      <span className="bg-foreground hidden size-2 rounded-full group-data-[status=active]/generation-timeline-step:block" />
      <CheckIcon className="text-faint hidden size-4 group-data-[status=completed]/generation-timeline-step:block" />
      <CircleAlertIcon className="text-destructive-text hidden size-4 group-data-[status=failed]/generation-timeline-step:block" />
    </span>
  );
}

/** The phase's name, muted unless it's the one running (or where it stopped). */
function GenerationTimelineStepLabel({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground col-start-2 text-sm leading-5",
        "group-data-[status=active]/generation-timeline-step:text-foreground group-data-[status=active]/generation-timeline-step:shimmer group-data-paused/generation-timeline:shimmer-none group-data-[status=active]/generation-timeline-step:font-medium",
        "group-data-[status=failed]/generation-timeline-step:text-foreground group-data-[status=failed]/generation-timeline-step:font-medium",
        className,
      )}
      data-slot="generation-timeline-step-label"
      {...props}
    />
  );
}

/** What the running phase is doing right now; hidden on every other row. */
function GenerationTimelineStepDetail({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground col-start-2 hidden text-xs group-data-[status=active]/generation-timeline-step:block",
        className,
      )}
      data-slot="generation-timeline-step-detail"
      {...props}
    />
  );
}

/** How long the phase took, or has taken so far, in mono at the row's end, level with its label. */
function GenerationTimelineStepTime({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground col-start-3 row-start-1 font-mono text-xs leading-5 tabular-nums",
        className,
      )}
      data-slot="generation-timeline-step-time"
      {...props}
    />
  );
}

export {
  GenerationTimeline,
  GenerationTimelineDescription,
  GenerationTimelineHeader,
  GenerationTimelineProgress,
  GenerationTimelineStatus,
  GenerationTimelineStep,
  GenerationTimelineStepDetail,
  GenerationTimelineStepIndicator,
  GenerationTimelineStepLabel,
  GenerationTimelineStepTime,
  GenerationTimelineSteps,
  GenerationTimelineTitle,
};

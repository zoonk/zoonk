"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import {
  ProgressIndicator,
  ProgressRoot,
  type ProgressRootProps,
  ProgressTrack,
  ProgressValue,
} from "@zoonk/ui/components/progress";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, CircleAlertIcon } from "lucide-react";

export type GenerationTimelineStepStatus = "active" | "completed" | "failed" | "pending";

/**
 * A wait for generated content: a header with the progress bar, then one row per phase. It holds
 * no copy; callers pass every label. `data-paused` on it (a lost connection) stops the rows'
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
 * The wait is usually the page's main content, so its title is the page's heading; a wait inside
 * a screen that has its own (`render`, such as `<h2 />`) takes the next level.
 */
function GenerationTimelineTitle({ className, render, ...props }: useRender.ComponentProps<"h1">) {
  return useRender({
    defaultTagName: "h1",
    props: mergeProps<"h1">(
      {
        className: cn(
          "text-2xl leading-tight font-semibold tracking-tight text-balance",
          className,
        ),
      },
      props,
    ),
    render,
    state: { slot: "generation-timeline-title" },
  });
}

function GenerationTimelineDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-base text-pretty", className)}
      data-slot="generation-timeline-description"
      {...props}
    />
  );
}

/**
 * The bar with its percentage. `aria-label` names what is being made; pass `locale` so the server
 * and the browser format the percentage the same way.
 */
function GenerationTimelineProgress({
  className,
  ...props
}: ProgressRootProps & { "aria-label": string }) {
  return (
    <ProgressRoot
      className={cn("flex-nowrap items-center gap-3", className)}
      data-slot="generation-timeline-progress"
      {...props}
    >
      <ProgressTrack className="h-2 flex-1">
        <ProgressIndicator className="rounded-full duration-700 ease-out motion-reduce:transition-none" />
      </ProgressTrack>
      <ProgressValue className="ml-0 min-w-[4ch] text-right font-medium" />
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
      className={cn("flex flex-col", className)}
      data-slot="generation-timeline-steps"
      {...props}
    />
  );
}

/**
 * One phase: an indicator, its label and, while it runs, a detail line. The connector to the next
 * row fills in once this phase is done.
 */
function GenerationTimelineStep({
  children,
  className,
  status,
  ...props
}: React.ComponentProps<"li"> & { status: GenerationTimelineStepStatus }) {
  return (
    <li
      aria-current={status === "active" ? "step" : undefined}
      className={cn(
        "group/generation-timeline-step relative grid grid-cols-[1.5rem_1fr] gap-x-3 pb-5 last:pb-0",
        className,
      )}
      data-slot="generation-timeline-step"
      data-status={status}
      {...props}
    >
      <span
        aria-hidden="true"
        className="bg-border group-data-[status=completed]/generation-timeline-step:bg-foreground absolute top-7 bottom-1 left-3 w-px -translate-x-1/2 group-last/generation-timeline-step:hidden"
      />
      {children}
    </li>
  );
}

const indicatorClassName = cn(
  "relative row-span-2 flex size-6 items-center justify-center rounded-full border-2",
  "border-muted-foreground/60 border-dashed",
  "group-data-[status=active]/generation-timeline-step:border-foreground group-data-[status=active]/generation-timeline-step:border-solid",
  "group-data-[status=completed]/generation-timeline-step:bg-foreground group-data-[status=completed]/generation-timeline-step:text-background group-data-[status=completed]/generation-timeline-step:border-transparent",
  "group-data-[status=failed]/generation-timeline-step:text-destructive group-data-[status=failed]/generation-timeline-step:border-0",
);

/**
 * An empty ring while the phase waits, a dot with a soft breathing ring while it runs (still when
 * the timeline is paused or motion is reduced), a check once done and an alert where it stopped.
 */
function GenerationTimelineStepIndicator({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(indicatorClassName, className)}
      data-slot="generation-timeline-step-indicator"
      {...props}
    >
      <span className="animate-breathe border-foreground/30 absolute -inset-0.5 hidden rounded-full border-2 group-data-paused/generation-timeline:animate-none group-data-[status=active]/generation-timeline-step:block motion-reduce:animate-none" />
      <span className="bg-foreground hidden size-2 rounded-full group-data-[status=active]/generation-timeline-step:block" />
      <CheckIcon className="hidden size-3.5 stroke-3 group-data-[status=completed]/generation-timeline-step:block" />
      <CircleAlertIcon className="hidden size-6 group-data-[status=failed]/generation-timeline-step:block" />
    </span>
  );
}

/** The phase's name; one line of it sits level with the indicator. */
function GenerationTimelineStepLabel({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "col-start-2 text-sm leading-6",
        "group-data-[status=pending]/generation-timeline-step:text-muted-foreground",
        "group-data-[status=completed]/generation-timeline-step:text-muted-foreground",
        "group-data-[status=active]/generation-timeline-step:shimmer group-data-paused/generation-timeline:shimmer-none group-data-[status=active]/generation-timeline-step:font-medium",
        "group-data-[status=failed]/generation-timeline-step:font-medium",
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
        "text-muted-foreground animate-in fade-in-0 col-start-2 hidden text-sm duration-500 group-data-[status=active]/generation-timeline-step:block motion-reduce:animate-none",
        className,
      )}
      data-slot="generation-timeline-step-detail"
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
  GenerationTimelineSteps,
  GenerationTimelineTitle,
};

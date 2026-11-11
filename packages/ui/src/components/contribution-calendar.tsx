"use client";

import {
  ChartInspector,
  ChartInspectorPoint,
  ChartInspectorPoints,
  ChartInspectorTooltip,
  type ChartPointDetail,
} from "@zoonk/ui/components/chart-inspector";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";
import { cn } from "@zoonk/ui/lib/utils";
import { type ComponentProps } from "react";
import { getContributionCalendarTargetIndex } from "./_utils/contribution-calendar-keyboard";

const NO_DETAILS: readonly ChartPointDetail[] = [];

const VIEWPORT_SLOT = "contribution-calendar-viewport";

/**
 * The viewport's scroller clips what's drawn outside the grid, so the ring sits inside the day and
 * keyboard focus rings the day itself. Its inner line keeps it readable on every level's color.
 */
const DAY_RING_CLASS = cn(
  "data-active:inset-ring-foreground data-active:ring-background data-active:ring-3 data-active:inset-ring-2 data-active:ring-inset",
  "in-focus-visible:data-current:inset-ring-foreground in-focus-visible:data-current:ring-background in-focus-visible:data-current:ring-3 in-focus-visible:data-current:inset-ring-2 in-focus-visible:data-current:ring-inset",
);

const CALENDAR_SIZE_CLASS = cn(
  "@container/calendar [--calendar-gap:round(down,clamp(0.125rem,0.25cqw,0.375rem),1px)]",
  "[--calendar-cell:clamp(0.625rem,round(down,calc((100cqw-(var(--calendar-weeks,53)-1)*var(--calendar-gap))/var(--calendar-weeks,53)),1px),2.5rem)]",
  "pointer-coarse:[--calendar-cell:1.25rem]",
);

/**
 * `details` say each day's date and value, in the days' index order. A day's tooltip stays inside the
 * viewport: above the day, or below it where that would cover the caption.
 */
export function ContributionCalendar({
  children,
  className,
  defaultIndex = 0,
  details = NO_DETAILS,
  style,
  weeks,
  ...props
}: ComponentProps<"figure"> & {
  defaultIndex?: number;
  details?: readonly ChartPointDetail[];
  weeks?: number;
}) {
  const weeksStyle: CSSPropertiesWithVariables = weeks ? { "--calendar-weeks": weeks } : {};

  return (
    <ChartInspector defaultIndex={defaultIndex} details={details}>
      <figure
        className={cn("flex min-w-0 flex-col gap-3", CALENDAR_SIZE_CLASS, className)}
        data-slot="contribution-calendar"
        style={{ ...weeksStyle, ...style }}
        {...props}
      >
        {children}
        <ChartInspectorTooltip within={`[data-slot="${VIEWPORT_SLOT}"]`} />
      </figure>
    </ChartInspector>
  );
}

export function ContributionCalendarCaption({
  children,
  className,
  ...props
}: ComponentProps<"figcaption">) {
  return (
    <figcaption
      className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-1", className)}
      data-slot="contribution-calendar-caption"
      {...props}
    >
      {children}
    </figcaption>
  );
}

export function ContributionCalendarTitle({ children, className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-sm leading-5 font-semibold tracking-[-0.01em]", className)}
      data-slot="contribution-calendar-title"
      {...props}
    >
      {children}
    </h2>
  );
}

/**
 * RTL so an overflowing calendar opens at its newest edge. On touch it is as wide as a whole number of
 * weeks and snaps to them, so a swipe never rests on half a week.
 */
export function ContributionCalendarViewport({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "ml-auto w-full min-w-0 overflow-x-auto pb-1 pointer-coarse:w-[calc(round(down,100%+var(--calendar-gap),var(--calendar-cell)+var(--calendar-gap))-var(--calendar-gap))] pointer-coarse:snap-x pointer-coarse:snap-mandatory",
        className,
      )}
      data-slot={VIEWPORT_SLOT}
      dir="rtl"
      {...props}
    >
      {children}
    </div>
  );
}

/** A physical auto margin left-aligns it inside the RTL viewport. */
export function ContributionCalendarContent({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn("mr-auto flex w-max min-w-full flex-col gap-4", className)}
      data-slot="contribution-calendar-content"
      dir="ltr"
      {...props}
    >
      {children}
    </div>
  );
}

/** Name it with `aria-label`. */
export function ContributionCalendarGrid({
  className,
  ...props
}: ComponentProps<typeof ChartInspectorPoints>) {
  return (
    <ChartInspectorPoints
      className={cn(
        "flex w-max min-w-full justify-between gap-(--calendar-gap) focus-visible:ring-0 [&>:last-child_[data-slot=contribution-calendar-period]]:right-0 [&>:last-child_[data-slot=contribution-calendar-period]]:left-auto [&>:nth-child(-n+2)_[data-slot=contribution-calendar-period]]:hidden",
        className,
      )}
      data-slot="contribution-calendar-grid"
      dir="ltr"
      getTargetIndex={getContributionCalendarTargetIndex}
      {...props}
    />
  );
}

export function ContributionCalendarWeek({ children, className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative grid w-(--calendar-cell) shrink-0 snap-end grid-rows-7 gap-(--calendar-gap) pt-5",
        className,
      )}
      data-slot="contribution-calendar-week"
      {...props}
    >
      {children}
    </div>
  );
}

export function ContributionCalendarPeriod({
  children,
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-faint absolute top-0 left-0 font-mono text-[10px] whitespace-nowrap tabular-nums",
        className,
      )}
      data-slot="contribution-calendar-period"
      {...props}
    >
      {children}
    </span>
  );
}

export function ContributionCalendarDay({
  className,
  ...props
}: ComponentProps<typeof ChartInspectorPoint>) {
  return (
    <ChartInspectorPoint
      aria-hidden="true"
      className={cn("size-(--calendar-cell) shrink-0 rounded-[2px]", DAY_RING_CLASS, className)}
      data-slot="contribution-calendar-day"
      {...props}
    />
  );
}

export function ContributionCalendarLegend({
  children,
  className,
  role = "group",
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex items-center justify-end gap-1 text-[0.6875rem]",
        className,
      )}
      data-slot="contribution-calendar-legend"
      role={role}
      {...props}
    >
      {children}
    </div>
  );
}

export function ContributionCalendarLegendLabel({
  children,
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span className={className} data-slot="contribution-calendar-legend-label" {...props}>
      {children}
    </span>
  );
}

export function ContributionCalendarLegendSwatch({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-2.5 rounded-[2px]", className)}
      data-slot="contribution-calendar-legend-swatch"
      {...props}
    />
  );
}

export function ContributionCalendarGridSkeleton({
  className,
  ...props
}: ComponentProps<typeof Skeleton>) {
  return (
    <Skeleton
      className={cn(
        "h-[calc(1.25rem+7*var(--calendar-cell)+6*var(--calendar-gap)+0.25rem)] w-full rounded-lg",
        className,
      )}
      data-slot="contribution-calendar-grid-skeleton"
      {...props}
    />
  );
}

export function ContributionCalendarLegendSkeleton({
  className,
  ...props
}: ComponentProps<typeof Skeleton>) {
  return (
    <Skeleton
      className={cn("h-3 w-24", className)}
      data-slot="contribution-calendar-legend-skeleton"
      {...props}
    />
  );
}

"use client";

import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";
import { cn } from "@zoonk/ui/lib/utils";
import { type ComponentProps, createContext, use, useId, useMemo, useState } from "react";
import { getContributionCalendarTargetIndex } from "./_utils/contribution-calendar-keyboard";

const DAY_SELECTOR = '[data-slot="contribution-calendar-day"]';

const NO_LABELS: readonly string[] = [];

type ContributionCalendarContextValue = {
  activeIndex: number;
  inspecting: boolean;
  labels: readonly string[];
  readoutId: string;
  setActiveIndex: (index: number) => void;
};

const ContributionCalendarContext = createContext<ContributionCalendarContextValue | null>(null);

function useContributionCalendar(): ContributionCalendarContextValue {
  const context = use(ContributionCalendarContext);

  if (!context) {
    throw new Error("Contribution calendar parts must be used inside ContributionCalendar");
  }

  return context;
}

function getEventDayIndex(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const day = target.closest<HTMLElement>(DAY_SELECTOR);
  const index = day ? Number(day.dataset.index) : Number.NaN;

  return Number.isInteger(index) ? index : null;
}

const CALENDAR_SIZE_CLASS = cn(
  "@container/calendar [--calendar-gap:0.125rem]",
  "[--calendar-cell:clamp(0.625rem,round(down,calc((100cqw-(var(--calendar-weeks,53)-1)*var(--calendar-gap))/var(--calendar-weeks,53)),1px),1rem)]",
  "pointer-coarse:[--calendar-cell:1.25rem]",
);

export function ContributionCalendar({
  children,
  className,
  defaultIndex = 0,
  labels = NO_LABELS,
  style,
  weeks,
  ...props
}: ComponentProps<"figure"> & {
  defaultIndex?: number;
  labels?: readonly string[];
  weeks?: number;
}) {
  const readoutId = useId();
  const [picked, setPicked] = useState<number | null>(null);

  const weeksStyle: CSSPropertiesWithVariables = weeks ? { "--calendar-weeks": weeks } : {};

  const value = useMemo<ContributionCalendarContextValue>(
    () => ({
      activeIndex: picked ?? defaultIndex,
      inspecting: picked !== null,
      labels,
      readoutId,
      setActiveIndex: setPicked,
    }),
    [defaultIndex, labels, picked, readoutId],
  );

  return (
    <ContributionCalendarContext value={value}>
      <figure
        className={cn("flex min-w-0 flex-col gap-3", CALENDAR_SIZE_CLASS, className)}
        data-slot="contribution-calendar"
        style={{ ...weeksStyle, ...style }}
        {...props}
      >
        {children}
      </figure>
    </ContributionCalendarContext>
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

/** RTL so an overflowing calendar opens at its newest edge. */
export function ContributionCalendarViewport({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "ml-auto w-full min-w-0 overflow-x-auto pb-1 pointer-coarse:w-[calc(round(down,100%+var(--calendar-gap),var(--calendar-cell)+var(--calendar-gap))-var(--calendar-gap))]",
        className,
      )}
      data-slot="contribution-calendar-viewport"
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
export function ContributionCalendarGrid({ children, className, ...props }: ComponentProps<"div">) {
  const { activeIndex, labels, readoutId, setActiveIndex } = useContributionCalendar();

  const pick = (target: EventTarget | null) => {
    const index = getEventDayIndex(target);

    if (index !== null) {
      setActiveIndex(index);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = getContributionCalendarTargetIndex({
      currentIndex: activeIndex,
      key: event.key,
      totalDays: labels.length,
    });

    if (index === null) {
      return;
    }

    event.preventDefault();
    setActiveIndex(index);

    event.currentTarget
      .querySelector(`${DAY_SELECTOR}[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- The grid is one control: arrows and the pointer pick a day for the readout.
    <div
      aria-describedby={readoutId}
      className={cn(
        "focus-visible:ring-ring/50 flex w-max min-w-full cursor-pointer justify-between gap-(--calendar-gap) rounded-sm outline-none focus-visible:ring-[3px] [&>:last-child_[data-slot=contribution-calendar-period]]:right-0 [&>:last-child_[data-slot=contribution-calendar-period]]:left-auto [&>:nth-child(-n+2)_[data-slot=contribution-calendar-period]]:hidden",
        className,
      )}
      data-slot="contribution-calendar-grid"
      dir="ltr"
      onClick={(event) => pick(event.target)}
      onFocus={() => setActiveIndex(activeIndex)}
      onKeyDown={onKeyDown}
      onPointerMove={(event) => pick(event.target)}
      role="group"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- One tab stop for the whole calendar, instead of a tiny target per day.
      tabIndex={0}
      {...props}
    >
      {children}
    </div>
  );
}

export function ContributionCalendarWeek({ children, className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative grid w-(--calendar-cell) shrink-0 grid-rows-7 gap-(--calendar-gap) pt-5",
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
  index,
  ...props
}: ComponentProps<"span"> & { index: number }) {
  const { activeIndex, inspecting } = useContributionCalendar();
  const isActive = inspecting && index === activeIndex;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-(--calendar-cell) shrink-0 rounded-[2px]",
        isActive && "ring-foreground ring-2 ring-offset-1",
        className,
      )}
      data-active={isActive || undefined}
      data-index={index}
      data-slot="contribution-calendar-day"
      {...props}
    />
  );
}

export function ContributionCalendarReadout({ className, ...props }: ComponentProps<"p">) {
  const { activeIndex, labels, readoutId } = useContributionCalendar();

  return (
    <p
      aria-live="polite"
      className={cn(
        "text-muted-foreground min-h-5 font-mono text-xs leading-5 tabular-nums",
        className,
      )}
      data-slot="contribution-calendar-readout"
      id={readoutId}
      {...props}
    >
      {labels.at(activeIndex)}
    </p>
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

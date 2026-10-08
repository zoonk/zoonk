"use client";

import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { type ComponentProps, createContext, use, useId, useMemo, useState } from "react";
import { getContributionCalendarTargetIndex } from "./_utils/contribution-calendar-keyboard";

const DAY_SELECTOR = '[data-slot="contribution-calendar-day"]';

const NO_LABELS: readonly string[] = [];

/**
 * Which day the calendar reads out: the one under the pointer, tapped, or reached with the arrow
 * keys, starting on the caller's default (usually the newest day with activity).
 */
type ContributionCalendarContextValue = {
  activeIndex: number;
  /** Whether the learner moved to a day yet; until then no square is marked. */
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

/** The day a pointer or tap event is on, by the index its square carries. */
function getEventDayIndex(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const day = target.closest<HTMLElement>(DAY_SELECTOR);
  const index = day ? Number(day.dataset.index) : Number.NaN;

  return Number.isInteger(index) ? index : null;
}

/**
 * A year of days as small squares, the way contribution charts look, read one day at a time: the
 * readout under the grid says the day under the pointer, the one tapped, or the one reached with
 * the arrow keys. The grid is the calendar's one control (a single tab stop, as large as the
 * chart), so the squares stay small without hundreds of tiny targets. `labels` has one sentence
 * per day, in the days' order.
 */
export function ContributionCalendar({
  children,
  className,
  defaultIndex = 0,
  labels = NO_LABELS,
  ...props
}: ComponentProps<"figure"> & {
  /** The day read out before the learner picks one. */
  defaultIndex?: number;
  /** One sentence per day; a loading calendar has none yet. */
  labels?: readonly string[];
}) {
  const readoutId = useId();
  const [picked, setPicked] = useState<number | null>(null);

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
        className={cn("flex min-w-0 flex-col gap-4", className)}
        data-slot="contribution-calendar"
        {...props}
      >
        {children}
      </figure>
    </ContributionCalendarContext>
  );
}

/**
 * Groups the chart title and supporting description in the semantic caption
 * shared by every contribution-calendar consumer.
 */
export function ContributionCalendarCaption({
  children,
  className,
  ...props
}: ComponentProps<"figcaption">) {
  return (
    <figcaption
      className={cn("flex flex-col gap-1", className)}
      data-slot="contribution-calendar-caption"
      {...props}
    >
      {children}
    </figcaption>
  );
}

/**
 * Gives each contribution calendar a visible heading while keeping its
 * typography consistent across metrics and applications.
 */
export function ContributionCalendarTitle({ children, className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn("font-semibold tracking-tight", className)}
      data-slot="contribution-calendar-title"
      {...props}
    >
      {children}
    </h2>
  );
}

/**
 * Presents caller-owned context such as the visible date range without making
 * the shared calendar depend on one product's vocabulary.
 */
export function ContributionCalendarDescription({
  children,
  className,
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="contribution-calendar-description"
      {...props}
    >
      {children}
    </p>
  );
}

/**
 * Starts overflowing calendars at their newest edge while remaining a normal
 * left-aligned viewport when the complete grid fits. The viewport rounds down
 * to a whole number of week columns (larger on touch screens), so no square or
 * period label is cut.
 */
export function ContributionCalendarViewport({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "ml-auto w-full min-w-0 overflow-x-auto pb-1 pointer-coarse:w-[calc(round(down,100%+0.125rem,1.375rem)-0.125rem)]",
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

/**
 * Keeps the grid and its supporting content on one intrinsic-width canvas.
 * The physical auto margin left-aligns calendars that fit while the surrounding
 * RTL viewport still opens overflowing calendars at their newest edge.
 */
export function ContributionCalendarContent({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn("mr-auto flex w-max flex-col gap-4", className)}
      data-slot="contribution-calendar-content"
      dir="ltr"
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * The calendar's one control: the pointer or a tap picks the day under it, and once focused the
 * arrow keys move a day or a week (scrolling the day into view). Name it with `aria-label`; the
 * readout under it says the day.
 */
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
        "focus-visible:ring-ring/50 flex w-max cursor-pointer gap-0.5 rounded-sm outline-none focus-visible:ring-[3px] [&>:last-child_[data-slot=contribution-calendar-period]]:right-0 [&>:last-child_[data-slot=contribution-calendar-period]]:left-auto",
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

/**
 * Aligns seven contribution days vertically and reserves a compact header row
 * for an optional month or period label.
 */
export function ContributionCalendarWeek({ children, className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative grid w-2.5 shrink-0 grid-rows-7 gap-0.5 pt-5 pointer-coarse:w-5",
        className,
      )}
      data-slot="contribution-calendar-week"
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Positions a period label above the first week that represents it without
 * affecting the seven-row day grid.
 */
export function ContributionCalendarPeriod({
  children,
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground absolute top-0 left-0 text-[10px] whitespace-nowrap",
        className,
      )}
      data-slot="contribution-calendar-period"
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * One day's square, in the caller's color for its value (`className`), at its place in the days'
 * order (`index`). The day being read out is ringed once the learner picks one.
 */
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
        "size-2.5 shrink-0 rounded-[2px] pointer-coarse:size-5",
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

/** Says the day being read out, in the caller's words, as the learner moves through the days. */
export function ContributionCalendarReadout({ className, ...props }: ComponentProps<"p">) {
  const { activeIndex, labels, readoutId } = useContributionCalendar();

  return (
    <p
      aria-live="polite"
      className={cn("text-foreground min-h-5 text-sm font-medium", className)}
      data-slot="contribution-calendar-readout"
      id={readoutId}
      {...props}
    >
      {labels.at(activeIndex)}
    </p>
  );
}

/**
 * Aligns a compact intensity key with the end of the contribution grid while
 * leaving its labels and swatches fully caller-composable.
 */
export function ContributionCalendarLegend({
  children,
  className,
  role = "group",
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex items-center justify-end gap-1.5 text-xs",
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

/**
 * Gives legend copy a stable semantic element without prescribing what the
 * scale means in any particular product context.
 */
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

/**
 * Matches the default day-square geometry while allowing each consumer to
 * supply its own semantic color or intensity class.
 */
export function ContributionCalendarLegendSwatch({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-2.5 rounded-[2px] pointer-coarse:size-5", className)}
      data-slot="contribution-calendar-legend-swatch"
      {...props}
    />
  );
}

/**
 * Reserves the shared calendar-grid geometry while a consumer's private data
 * streams, without requiring each application to duplicate its dimensions.
 */
export function ContributionCalendarGridSkeleton({
  className,
  ...props
}: ComponentProps<typeof Skeleton>) {
  return (
    <Skeleton
      className={cn("h-25.5 w-full rounded-lg pointer-coarse:h-43", className)}
      data-slot="contribution-calendar-grid-skeleton"
      {...props}
    />
  );
}

/**
 * Reserves the compact, end-aligned legend geometry used below contribution
 * grids while the final labels and swatches are unavailable.
 */
export function ContributionCalendarLegendSkeleton({
  className,
  ...props
}: ComponentProps<typeof Skeleton>) {
  return (
    <Skeleton
      className={cn("ml-auto h-3 w-24", className)}
      data-slot="contribution-calendar-legend-skeleton"
      {...props}
    />
  );
}

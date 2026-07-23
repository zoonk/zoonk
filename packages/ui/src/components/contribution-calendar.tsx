"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { TooltipContent } from "@zoonk/ui/components/tooltip";
import { cn } from "@zoonk/ui/lib/utils";
import { type ComponentProps, type ReactNode, createContext, use, useState } from "react";
import { getContributionCalendarTargetIndex } from "./_utils/contribution-calendar-keyboard";

type ContributionCalendarDayContextValue = { actions: { toggleOpen: () => void } };

const DAY_TRIGGER_SELECTOR = '[data-slot="contribution-calendar-day-trigger"]';

const ContributionCalendarDayContext = createContext<ContributionCalendarDayContextValue | null>(
  null,
);

/**
 * Finds the interactive day represented by a keyboard event, including events
 * that originate from a visual child inside the button.
 */
function getContributionCalendarDayTrigger(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const trigger = target.closest(DAY_TRIGGER_SELECTOR);

  return trigger instanceof HTMLButtonElement ? trigger : null;
}

/**
 * Moves focus between dates without adding hundreds of calendar cells to the
 * tab sequence. Updating the two tab indexes preserves the most recently
 * inspected date as the calendar's single tab stop.
 */
function moveContributionCalendarFocus(event: React.KeyboardEvent<HTMLElement>): void {
  const currentTrigger = getContributionCalendarDayTrigger(event.target);

  if (!currentTrigger) {
    return;
  }

  const triggers = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>(DAY_TRIGGER_SELECTOR),
  ];

  const currentIndex = triggers.indexOf(currentTrigger);

  const targetIndex = getContributionCalendarTargetIndex({
    currentIndex,
    key: event.key,
    totalDays: triggers.length,
  });

  if (targetIndex === null) {
    return;
  }

  event.preventDefault();

  const targetTrigger = triggers.at(targetIndex);

  if (!targetTrigger) {
    return;
  }

  currentTrigger.tabIndex = -1;
  targetTrigger.tabIndex = 0;
  targetTrigger.focus();
}

/**
 * Groups the calendar layout and shares one tooltip delay policy across every
 * day, avoiding hundreds of independent providers in dense contribution grids.
 */
export function ContributionCalendar({
  children,
  className,
  onKeyDown,
  ...props
}: ComponentProps<"figure">) {
  return (
    <TooltipPrimitive.Provider delay={0}>
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- arrow-key handling is delegated from the interactive day buttons */}
      <figure
        className={cn("flex min-w-0 flex-col gap-4", className)}
        data-slot="contribution-calendar"
        onKeyDown={(event) => {
          onKeyDown?.(event);

          if (!event.defaultPrevented) {
            moveContributionCalendarFocus(event);
          }
        }}
        {...props}
      >
        {children}
      </figure>
    </TooltipPrimitive.Provider>
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
 * left-aligned viewport when the complete grid fits. Coarse-pointer viewports
 * round down to a whole number of default week columns, preventing clipped
 * squares and period labels without covering interactive content.
 */
export function ContributionCalendarViewport({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "ml-auto w-full min-w-0 overflow-x-auto pb-1 pointer-coarse:w-[calc(round(down,100%+0.125rem,1.625rem)-0.125rem)]",
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
 * Keeps week columns at their natural width so legends and other content can
 * align with the final plotted week instead of the viewport boundary.
 */
export function ContributionCalendarGrid({ children, className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-max gap-0.5 [&>:last-child_[data-slot=contribution-calendar-period]]:right-0 [&>:last-child_[data-slot=contribution-calendar-period]]:left-auto",
        className,
      )}
      data-slot="contribution-calendar-grid"
      dir="ltr"
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
        "relative grid w-2.5 shrink-0 grid-rows-7 gap-0.5 pt-5 pointer-coarse:w-6",
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
 * Owns one day's transient detail state so its trigger and tooltip remain
 * composable while hover, focus, escape, outside press, and tap stay aligned.
 */
export function ContributionCalendarDay({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <ContributionCalendarDayContext
      value={{ actions: { toggleOpen: () => setOpen((current) => !current) } }}
    >
      <TooltipPrimitive.Root onOpenChange={setOpen} open={open}>
        {children}
      </TooltipPrimitive.Root>
    </ContributionCalendarDayContext>
  );
}

/**
 * Gives day triggers access to the nearest day's tap action and fails loudly
 * when a trigger is accidentally rendered outside its required compound root.
 */
function useContributionCalendarDay(): ContributionCalendarDayContextValue {
  const context = use(ContributionCalendarDayContext);

  if (!context) {
    throw new Error("ContributionCalendarDayTrigger must be used inside ContributionCalendarDay");
  }

  return context;
}

/**
 * Renders an interactive contribution square. Base UI owns hover, focus,
 * outside-press, and escape behavior; the merged click toggles the same detail
 * for touch and pointer users without coupling the component to domain data.
 */
export function ContributionCalendarDayTrigger({
  className,
  onClick,
  type = "button",
  ...props
}: Omit<TooltipPrimitive.Trigger.Props, "closeOnClick">) {
  const {
    actions: { toggleOpen },
  } = useContributionCalendarDay();

  return (
    <TooltipPrimitive.Trigger
      className={cn(
        "focus-visible:ring-ring/50 flex size-2.5 cursor-pointer appearance-none items-center justify-center rounded-[2px] border-0 bg-transparent p-0 outline-none focus-visible:ring-[3px] focus-visible:ring-inset pointer-coarse:size-6",
        className,
      )}
      closeOnClick={false}
      data-slot="contribution-calendar-day-trigger"
      onClick={(event) => {
        onClick?.(event);

        if (!(event.defaultPrevented || event.baseUIHandlerPrevented)) {
          toggleOpen();
        }
      }}
      type={type}
      {...props}
    />
  );
}

/**
 * Draws the metric square inside its interactive day trigger, allowing
 * coarse-pointer layouts to enlarge the hit target while keeping the mark inset.
 */
export function ContributionCalendarDayIndicator({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-2.5 shrink-0 rounded-[2px] pointer-coarse:size-5", className)}
      data-slot="contribution-calendar-day-indicator"
      {...props}
    />
  );
}

/**
 * Presents caller-owned detail content in the shared tooltip surface so every
 * contribution calendar can describe its own metric and date vocabulary.
 */
export function ContributionCalendarDayContent({
  className,
  ...props
}: ComponentProps<typeof TooltipContent>) {
  return (
    <TooltipContent
      className={cn("whitespace-nowrap", className)}
      data-slot="contribution-calendar-day-content"
      {...props}
    />
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
      className={cn("h-25.5 w-full rounded-lg pointer-coarse:h-50", className)}
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

import { cn } from "@zoonk/ui/lib/utils";

const PERCENT = 100;

/** A meter is a block; `span` draws one where only phrasing content may go (a `<summary>`). */
type MeterElement = "div" | "span";

/**
 * A thin track with a share filled in: Energy, a mission, a subject's weight. It sits next to its
 * number, so it's hidden from screen readers unless the caller labels it.
 */
export function Meter({
  as: Element = "div",
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: MeterElement }) {
  return (
    <Element
      aria-hidden="true"
      className={cn("bg-surface-3 block h-1.5 overflow-hidden rounded-[3px]", className)}
      data-slot="meter"
      {...props}
    />
  );
}

/** The filled part of a `Meter`, from a share between 0 and 1. */
export function MeterFill({
  as: Element = "div",
  className,
  share,
  style,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: MeterElement; share: number }) {
  return (
    <Element
      className={cn("bg-foreground block h-full rounded-[3px]", className)}
      data-slot="meter-fill"
      style={{ ...style, width: `${Math.min(1, Math.max(0, share)) * PERCENT}%` }}
      {...props}
    />
  );
}

/** A meter of parts' row: 6px tall, its parts 2px apart. */
export const METER_PARTS_CLASS = "flex h-1.5 w-full gap-0.5";

/**
 * A meter made of parts, under or beside the number it explains (a readout): each part as long as
 * its `weight` and colored by what it measures, 2px apart, so the number's make-up reads at a
 * glance (a day's blocks by their minutes, a plan's time by kind, a lesson's answers). 6px tall
 * in the app; a public page passes `h-2`. The words beside it carry the meaning, so it's hidden
 * from screen readers.
 */
export function MeterParts({
  as: Element = "div",
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: MeterElement }) {
  return (
    <Element
      aria-hidden="true"
      className={cn(METER_PARTS_CLASS, className)}
      data-slot="meter-parts"
      {...props}
    />
  );
}

/**
 * One part of `MeterParts`, on the track until a color says what it is: `bg-success` for progress
 * made, `bg-destructive` for a wrong answer, a kind's fill (`kindFillClass`), or the learner's
 * place as a blue ring (`ring-success ring-[1.5px] ring-inset bg-transparent`).
 */
export function MeterPart({
  as: Element = "div",
  className,
  style,
  weight = 1,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: MeterElement; weight?: number }) {
  return (
    <Element
      className={cn("bg-surface-3 block h-full min-w-1 basis-0 rounded-[3px]", className)}
      data-slot="meter-part"
      style={{ ...style, flexGrow: Math.max(0, weight) }}
      {...props}
    />
  );
}

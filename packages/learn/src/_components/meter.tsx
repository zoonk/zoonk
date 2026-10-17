import { cn } from "@zoonk/ui/lib/utils";

const PERCENT = 100;

/** A meter is a block; `span` draws one where only phrasing content may go (a `<summary>`). */
type MeterElement = "div" | "span";

/**
 * A thin rounded track with a share filled in: Energy, a mission, a subject's weight. It sits next
 * to its number, so it's hidden from screen readers unless the caller labels it.
 */
export function Meter({
  as: Element = "div",
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: MeterElement }) {
  return (
    <Element
      aria-hidden="true"
      className={cn("bg-muted block h-1.5 overflow-hidden rounded-full", className)}
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
      className={cn("bg-foreground block h-full rounded-full", className)}
      data-slot="meter-fill"
      style={{ ...style, width: `${Math.min(1, Math.max(0, share)) * PERCENT}%` }}
      {...props}
    />
  );
}

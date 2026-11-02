import { cn } from "@zoonk/ui/lib/utils";

const PERCENT = 100;

type MeterElement = "div" | "span";

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

/** `share` is 0 to 1. */
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

export const METER_PARTS_CLASS = "flex h-1.5 w-full gap-0.5";

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

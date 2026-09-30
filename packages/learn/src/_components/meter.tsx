import { cn } from "@zoonk/ui/lib/utils";

const PERCENT = 100;

/**
 * A thin rounded track with a share filled in: Energy, a mission, a subject's weight. It sits next
 * to its number, so it's hidden from screen readers unless the caller labels it.
 */
export function Meter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-muted in-data-[mode=fun]:bg-fun-track h-1.5 overflow-hidden rounded-full",
        className,
      )}
      data-slot="meter"
      {...props}
    />
  );
}

/** The filled part of a `Meter`, from a share between 0 and 1. */
export function MeterFill({
  className,
  share,
  style,
  ...props
}: React.ComponentProps<"div"> & { share: number }) {
  return (
    <div
      className={cn("bg-foreground h-full rounded-full", className)}
      data-slot="meter-fill"
      style={{ ...style, width: `${Math.min(1, Math.max(0, share)) * PERCENT}%` }}
      {...props}
    />
  );
}

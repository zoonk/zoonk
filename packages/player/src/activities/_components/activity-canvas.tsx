import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";

/** A box inside an activity's panel. Every card, slot, cell and code block there is this box. */
export const ACTIVITY_BOX_CLASS = "bg-background rounded-xl border";

/** A box that holds a line or two of text. */
export const ACTIVITY_CARD_CLASS = cn(ACTIVITY_BOX_CLASS, "px-3 py-2.5");

/** Added to a box the learner taps or drags. */
export const ACTIVITY_PRESS_CLASS =
  "focus-visible:ring-ring/50 min-h-11 text-left outline-none select-none focus-visible:ring-[3px]";

/** A box the learner types in. */
export const ACTIVITY_FIELD_CLASS = cn(
  ACTIVITY_BOX_CLASS,
  "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
);

/** A place still to fill: the same 1px line, dashed. */
export const ACTIVITY_EMPTY_CLASS = "border-dashed bg-transparent";

/**
 * A box's 2px line: the one the learner is working in, and the right and wrong ones once checked.
 * It is drawn inside the box, so the box and everything around it stay where they were.
 */
export const ACTIVITY_LINE_CLASS = {
  active: "border-viz-accent ring-viz-accent ring-1 ring-inset",
  right: "border-success ring-success ring-1 ring-inset",
  wrong: "border-destructive ring-destructive ring-1 ring-inset",
};

export function ActivityCanvas({
  className,
  labelId,
  ...props
}: React.ComponentProps<"figure"> & { labelId: string }) {
  return (
    <figure
      aria-labelledby={labelId}
      className={cn("bg-muted/50 flex flex-col gap-3 rounded-xl p-4", className)}
      data-slot="activity-canvas"
      {...props}
    />
  );
}

export function ActivityTextAlternative({
  className,
  ...props
}: React.ComponentProps<"figcaption">) {
  return (
    <figcaption
      className={cn("sr-only", className)}
      data-slot="activity-text-alternative"
      {...props}
    />
  );
}

export function ActivityCanvasLabel({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-xs", className)}
      data-slot="activity-canvas-label"
      {...props}
    />
  );
}

export function ActivityReadout({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-2xl font-medium tracking-tight tabular-nums", className)}
      data-slot="activity-readout"
      {...props}
    />
  );
}

export function ActivityCanvasSkeleton() {
  return <Skeleton className="h-64 w-full rounded-xl" data-slot="activity-canvas-skeleton" />;
}

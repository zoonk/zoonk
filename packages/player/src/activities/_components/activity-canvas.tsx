import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * The surface a template draws on, labelled by the activity's prompt. In Fun mode it sits on the
 * paper panel and follows its tokens, so renderers only use semantic colors.
 */
export function ActivityCanvas({
  className,
  labelId,
  ...props
}: React.ComponentProps<"figure"> & { labelId: string }) {
  return (
    <figure
      aria-labelledby={labelId}
      className={cn("bg-muted/50 flex flex-col gap-3 rounded-3xl p-4", className)}
      data-slot="activity-canvas"
      {...props}
    />
  );
}

/**
 * What the canvas shows, in words, for screen readers: every renderer describes its current state
 * here (the curve's shape, where the dot is, which side is heavier), so nothing is visual only.
 */
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

/** A small label above a canvas element, like an axis name or a legend. */
export function ActivityCanvasLabel({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-xs", className)}
      data-slot="activity-canvas-label"
      {...props}
    />
  );
}

/** The value the learner is changing, big enough to read at a glance. */
export function ActivityReadout({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "in-data-[mode=fun]:font-fun-display text-2xl font-bold tracking-tight tabular-nums",
        className,
      )}
      data-slot="activity-readout"
      {...props}
    />
  );
}

export function ActivityCanvasSkeleton() {
  return <Skeleton className="h-64 w-full rounded-3xl" data-slot="activity-canvas-skeleton" />;
}

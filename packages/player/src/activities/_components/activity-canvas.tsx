import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";

export function ActivityCanvas({
  className,
  labelId,
  ...props
}: React.ComponentProps<"figure"> & { labelId: string }) {
  return (
    <figure
      aria-labelledby={labelId}
      className={cn("bg-muted/50 flex flex-col gap-3 rounded-2xl p-4", className)}
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
      className={cn("font-mono text-2xl font-medium tracking-tight tabular-nums", className)}
      data-slot="activity-readout"
      {...props}
    />
  );
}

export function ActivityCanvasSkeleton() {
  return <Skeleton className="h-64 w-full rounded-2xl" data-slot="activity-canvas-skeleton" />;
}

"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "@zoonk/ui/lib/utils";

function Progress({ className, children, value, ...props }: ProgressPrimitive.Root.Props) {
  return (
    <ProgressPrimitive.Root
      className={cn("flex flex-wrap gap-3", className)}
      data-slot="progress"
      value={value}
      {...props}
    >
      {children}
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  );
}

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      className={cn(
        "bg-muted relative flex h-3 w-full items-center overflow-x-hidden rounded-4xl",
        className,
      )}
      data-slot="progress-track"
      {...props}
    />
  );
}

function ProgressIndicator({ className, ...props }: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      className={cn("bg-primary h-full transition-all", className)}
      data-slot="progress-indicator"
      {...props}
    />
  );
}

function ProgressLabel({ className, ...props }: ProgressPrimitive.Label.Props) {
  return (
    <ProgressPrimitive.Label
      className={cn("text-sm font-medium", className)}
      data-slot="progress-label"
      {...props}
    />
  );
}

function ProgressValue({ className, ...props }: ProgressPrimitive.Value.Props) {
  return (
    <ProgressPrimitive.Value
      className={cn("text-muted-foreground ml-auto text-sm tabular-nums", className)}
      data-slot="progress-value"
      {...props}
    />
  );
}

function ProgressDots({
  current,
  total,
  className,
}: {
  current: number;
  total: number;
  className?: string;
}) {
  return (
    <div
      aria-label={`Step ${current + 1} of ${total}`}
      aria-valuemax={total}
      aria-valuemin={1}
      aria-valuenow={current + 1}
      className={cn("flex gap-1.5", className)}
      role="progressbar"
    >
      {Array.from({ length: total }).map((_, index) => (
        <div
          aria-hidden="true"
          className={cn(
            "size-2 rounded-full transition-colors",
            index <= current
              ? "bg-foreground"
              : "bg-muted-foreground/30 dark:bg-muted-foreground/20",
          )}
          key={index}
        />
      ))}
    </div>
  );
}

function ProgressRoot({ className, ...props }: ProgressPrimitive.Root.Props) {
  return (
    <ProgressPrimitive.Root
      className={cn("flex flex-wrap gap-3", className)}
      data-slot="progress-root"
      {...props}
    />
  );
}

export {
  Progress,
  ProgressDots,
  ProgressIndicator,
  ProgressLabel,
  ProgressRoot,
  ProgressTrack,
  ProgressValue,
};

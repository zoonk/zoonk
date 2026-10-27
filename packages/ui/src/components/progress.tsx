"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * Base UI formats `aria-valuetext` with the runtime's locale, so the server ("0%") and a German
 * browser ("0 %") disagree and hydration fails. Every bar takes the app's locale instead.
 */
type ProgressRootProps = ProgressPrimitive.Root.Props & { locale: string };

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      className={cn(
        "bg-muted relative flex h-3 w-full items-center overflow-x-hidden rounded-lg",
        className,
      )}
      data-slot="progress-track"
      {...props}
    />
  );
}

/**
 * The share done, in blue (progress made: lessons done, a chapter's way through). A bar that says
 * where the learner is in a task they're doing passes the text color (`bg-foreground`).
 */
function ProgressIndicator({ className, ...props }: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      className={cn("bg-success h-full transition-[width]", className)}
      data-slot="progress-indicator"
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

function ProgressRoot({ className, ...props }: ProgressRootProps) {
  return (
    <ProgressPrimitive.Root
      className={cn("flex flex-wrap gap-3", className)}
      data-slot="progress-root"
      {...props}
    />
  );
}

export { ProgressIndicator, ProgressRoot, ProgressTrack, ProgressValue, type ProgressRootProps };

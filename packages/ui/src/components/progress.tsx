"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "@zoonk/ui/lib/utils";
import { createContext, useContext, useId } from "react";

/** The id a bar's `ProgressLabel` takes, which names the bar. */
const LabelIdContext = createContext<string | undefined>(undefined);

/**
 * Base UI formats `aria-valuetext` with the runtime's locale, so the server ("0%") and a German
 * browser ("0 %") disagree and hydration fails. Every bar takes the app's locale instead.
 */
type ProgressRootProps = ProgressPrimitive.Root.Props & { locale: string };

function Progress({ children, ...props }: ProgressRootProps) {
  return (
    <ProgressRoot data-slot="progress" {...props}>
      {children}
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressRoot>
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
  const labelId = useContext(LabelIdContext);

  return (
    <ProgressPrimitive.Label
      className={cn("text-sm font-medium", className)}
      data-slot="progress-label"
      id={labelId}
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

/**
 * Base UI links a bar to its `ProgressLabel` only once the page hydrates, so the root gives the
 * label its id and the bar has its name before then. A bar named with `aria-label` keeps that.
 */
function ProgressRoot({ className, ...props }: ProgressRootProps) {
  const labelId = useId();

  return (
    <LabelIdContext.Provider value={labelId}>
      <ProgressPrimitive.Root
        aria-labelledby={props["aria-label"] ? undefined : labelId}
        className={cn("flex flex-wrap gap-3", className)}
        data-slot="progress-root"
        {...props}
      />
    </LabelIdContext.Provider>
  );
}

export {
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressRoot,
  ProgressTrack,
  ProgressValue,
  type ProgressRootProps,
};

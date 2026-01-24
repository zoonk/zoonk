"use client";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@zoonk/ui/components/alert";
import { Button } from "@zoonk/ui/components/button";
import { Progress, ProgressLabel, ProgressValue } from "@zoonk/ui/components/progress";
import { cn } from "@zoonk/ui/lib/utils";
import { AlertCircleIcon, CheckIcon, type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

type PhaseStatus = "pending" | "active" | "completed";

function GenerationTimeline({ children }: { children: ReactNode }) {
  return (
    <div
      aria-live="polite"
      className="flex w-full max-w-md flex-col gap-6 py-8"
      data-slot="generation-timeline"
    >
      {children}
    </div>
  );
}

function GenerationTimelineHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3" data-slot="generation-timeline-header">
      {children}
    </div>
  );
}

function GenerationTimelineTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-lg font-semibold" data-slot="generation-timeline-title">
      {children}
    </h2>
  );
}

function GenerationTimelineProgress({ label, value }: { label: string; value: number }) {
  return (
    <Progress className="**:data-[slot=progress-track]:h-2" value={value}>
      <ProgressLabel className="sr-only">{label}</ProgressLabel>
      <ProgressValue />
    </Progress>
  );
}

function GenerationTimelineSteps({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex flex-col gap-0" data-slot="generation-timeline-steps">
      {children}
    </div>
  );
}

function GenerationTimelineStepIndicator({
  icon: Icon,
  status,
}: {
  icon: LucideIcon;
  status: PhaseStatus;
}) {
  if (status === "completed") {
    return (
      <div className="bg-foreground flex size-6 shrink-0 items-center justify-center rounded-full">
        <CheckIcon aria-hidden="true" className="text-background size-3.5" />
      </div>
    );
  }

  if (status === "active") {
    return (
      <div className="relative flex size-6 shrink-0 items-center justify-center">
        <div className="animate-breathe border-foreground/30 absolute inset-0 rounded-full border-2 motion-reduce:animate-none motion-reduce:opacity-50" />
        <div className="border-foreground flex size-6 items-center justify-center rounded-full border-2">
          <Icon aria-hidden="true" className="text-foreground size-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="border-muted-foreground/40 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-dashed">
      <Icon aria-hidden="true" className="text-muted-foreground/40 size-3" />
    </div>
  );
}

function GenerationTimelineStep({
  children,
  icon,
  isLast,
  status,
}: {
  children: ReactNode;
  icon: LucideIcon;
  isLast?: boolean;
  status: PhaseStatus;
}) {
  return (
    <div className="flex items-start gap-3" data-slot="generation-timeline-step">
      <div className="flex flex-col items-center">
        <GenerationTimelineStepIndicator icon={icon} status={status} />
        {!isLast && (
          <div
            aria-hidden="true"
            className={cn(
              "h-8 w-px",
              status === "completed" ? "bg-foreground" : "bg-muted-foreground/20",
            )}
          />
        )}
      </div>
      <span
        className={cn(
          "pt-0.5 text-sm",
          status === "completed" && "text-muted-foreground",
          status === "active" &&
            "animate-shimmer-text motion-reduce:text-foreground bg-[linear-gradient(90deg,var(--foreground)_0%,var(--foreground)_40%,var(--muted-foreground)_50%,var(--foreground)_60%,var(--foreground)_100%)] bg-size-[200%_100%] bg-clip-text font-medium text-transparent motion-reduce:animate-none motion-reduce:bg-none",
          status === "pending" && "text-muted-foreground/60",
        )}
      >
        {children}
      </span>
    </div>
  );
}

function GenerationProgressCompleted({
  children,
  subtitle,
}: {
  children: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div aria-live="polite" className="flex flex-col items-center gap-3 py-8">
      <div className="bg-muted flex size-12 items-center justify-center rounded-full">
        <CheckIcon aria-hidden="true" className="size-5" />
      </div>
      <span className="text-foreground font-medium">{children}</span>
      {subtitle && <span className="text-muted-foreground text-sm">{subtitle}</span>}
    </div>
  );
}

function GenerationProgressError({
  children,
  description,
  onRetry,
  retryLabel = "Try again",
}: {
  children: ReactNode;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircleIcon aria-hidden="true" />
      <AlertTitle>{children}</AlertTitle>
      {description && <AlertDescription>{description}</AlertDescription>}
      {onRetry && (
        <AlertAction>
          <Button onClick={onRetry} size="sm" variant="outline">
            {retryLabel}
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}

export {
  GenerationProgressCompleted,
  GenerationProgressError,
  GenerationTimeline,
  GenerationTimelineHeader,
  GenerationTimelineProgress,
  GenerationTimelineStep,
  GenerationTimelineSteps,
  GenerationTimelineTitle,
};

"use client";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@zoonk/ui/components/alert";
import { Button } from "@zoonk/ui/components/button";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@zoonk/ui/components/progress";
import { cn } from "@zoonk/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import { AlertCircleIcon, CheckIcon } from "lucide-react";
import type { ReactNode } from "react";

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
    <h2 className="font-semibold text-lg" data-slot="generation-timeline-title">
      {children}
    </h2>
  );
}

function GenerationTimelineProgress({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <Progress className="**:data-[slot=progress-track]:h-2" value={value}>
      <ProgressLabel className="sr-only">{label}</ProgressLabel>
      <ProgressValue />
    </Progress>
  );
}

function GenerationTimelineSteps({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative flex flex-col gap-0"
      data-slot="generation-timeline-steps"
    >
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
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground">
        <CheckIcon aria-hidden="true" className="size-3.5 text-background" />
      </div>
    );
  }

  if (status === "active") {
    return (
      <div className="relative flex size-6 shrink-0 items-center justify-center">
        <div className="absolute inset-0 animate-pulse rounded-full border-2 border-foreground/30" />
        <div className="flex size-6 items-center justify-center rounded-full border-2 border-foreground">
          <Icon aria-hidden="true" className="size-3 text-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/40 border-dashed">
      <Icon aria-hidden="true" className="size-3 text-muted-foreground/40" />
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
    <div
      className="flex items-start gap-3"
      data-slot="generation-timeline-step"
    >
      <div className="flex flex-col items-center">
        <GenerationTimelineStepIndicator icon={icon} status={status} />
        {!isLast && (
          <div
            aria-hidden="true"
            className={cn(
              "h-8 w-px",
              status === "completed"
                ? "bg-foreground"
                : "bg-muted-foreground/20",
            )}
          />
        )}
      </div>
      <span
        className={cn(
          "pt-0.5 text-sm",
          status === "completed" && "text-muted-foreground",
          status === "active" && "font-medium text-foreground",
          status === "pending" && "text-muted-foreground/60",
        )}
      >
        {children}
      </span>
    </div>
  );
}

type GenerationProgressCompletedProps = {
  children: ReactNode;
  subtitle?: ReactNode;
};

function GenerationProgressCompleted({
  children,
  subtitle,
}: GenerationProgressCompletedProps) {
  return (
    <div aria-live="polite" className="flex flex-col items-center gap-3 py-8">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <CheckIcon aria-hidden="true" className="size-5" />
      </div>
      <span className="font-medium text-foreground">{children}</span>
      {subtitle && (
        <span className="text-muted-foreground text-sm">{subtitle}</span>
      )}
    </div>
  );
}

type GenerationProgressErrorProps = {
  children: ReactNode;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
};

function GenerationProgressError({
  children,
  description,
  onRetry,
  retryLabel = "Try again",
}: GenerationProgressErrorProps) {
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

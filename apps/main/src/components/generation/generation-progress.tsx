"use client";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@zoonk/ui/components/alert";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { AlertCircleIcon, CheckIcon, SparklesIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

function GenerationProgressTriggering({ children }: { children: ReactNode }) {
  return (
    <div aria-live="polite" className="flex flex-col items-center gap-3 py-8">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Spinner className="size-5" />
      </div>
      <span className="font-medium text-foreground">{children}</span>
    </div>
  );
}

type GenerationProgressStreamingProps = {
  children: ReactNode;
  completedSteps?: ReactNode;
  icon?: ComponentProps<"svg">["children"];
};

function GenerationProgressStreaming({
  children,
  completedSteps,
  icon,
}: GenerationProgressStreamingProps) {
  const Icon = icon ? () => <>{icon}</> : SparklesIcon;

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="flex flex-col items-center gap-8 py-8"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          {icon ? (
            <Icon aria-hidden="true" className="size-5" />
          ) : (
            <Spinner className="size-5" />
          )}
        </div>
        <span className="font-medium text-foreground">{children}</span>
      </div>

      {completedSteps}
    </div>
  );
}

function GenerationProgressCompletedSteps({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="flex flex-col gap-2 text-sm">{children}</div>;
}

function GenerationProgressCompletedStep({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <CheckIcon aria-hidden="true" className="size-4 text-foreground" />
      <span>{children}</span>
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
      <AlertCircleIcon />
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
  GenerationProgressCompletedStep,
  GenerationProgressCompletedSteps,
  GenerationProgressError,
  GenerationProgressStreaming,
  GenerationProgressTriggering,
};

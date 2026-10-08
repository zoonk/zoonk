"use client";

import { Alert, AlertDescription, AlertTitle } from "@zoonk/ui/components/alert";
import { Button } from "@zoonk/ui/components/button";
import {
  GenerationTimeline,
  GenerationTimelineHeader,
  GenerationTimelineProgress,
  GenerationTimelineStatus,
  GenerationTimelineStep,
  GenerationTimelineStepDetail,
  GenerationTimelineStepIndicator,
  GenerationTimelineStepLabel,
  GenerationTimelineSteps,
} from "@zoonk/ui/components/generation-timeline";
import { useAnimatedProgress } from "@zoonk/ui/hooks/animated-progress";
import { useTickCount } from "@zoonk/ui/hooks/tick-count";
import { CircleAlertIcon, WifiOffIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { getDetailLine } from "./_utils/detail-line";
import { type PhaseProgress, type PhaseStatus, getPhaseProgress } from "./_utils/phase-progress";
import { type GenerationKind, getGenerationKind } from "./generation-kinds";
import { type GenerationFailure, type GenerationRun } from "./generation-run";
import { type PhaseCopy, useGenerationCopy } from "./use-generation-copy";

function isFollowing(run: GenerationRun): boolean {
  return run.status === "waiting" || run.status === "following";
}

/** The bar re-renders on its own as it drifts, so the rows don't. */
function WaitProgress({
  label,
  progress,
  run,
}: {
  label: string;
  progress: PhaseProgress<string>;
  run: GenerationRun;
}) {
  const locale = useLocale();

  const value = useAnimatedProgress({
    active: isFollowing(run),
    estimatedMs: progress.activeMs,
    progress: progress.progress,
    target: progress.target,
  });

  return <GenerationTimelineProgress aria-label={label} locale={locale} value={value} />;
}

/** What the running phase is doing now; the line changes every few seconds. */
function ActiveDetail({ copy, phase }: { copy: PhaseCopy; phase: string }) {
  const tick = useTickCount({ active: true, resetKey: phase });
  const line = getDetailLine({ lines: copy.lines, numbered: copy.numbered, tick });

  return line ? (
    <GenerationTimelineStepDetail key={line}>{line}</GenerationTimelineStepDetail>
  ) : null;
}

/** Where each phase stands, for screen readers: the indicator only shows it. */
function PhaseStatusText({ status }: { status: PhaseStatus }) {
  const t = useExtracted();

  const text = {
    active: t("in progress"),
    completed: t("done"),
    failed: t("stopped here"),
    pending: t("not started yet"),
  }[status];

  return <span className="sr-only">{`, ${text}`}</span>;
}

function FailureIcon({ failure }: { failure: GenerationFailure }) {
  return failure === "connection" ? (
    <WifiOffIcon aria-hidden="true" />
  ) : (
    <CircleAlertIcon aria-hidden="true" />
  );
}

/**
 * Why a wait stopped, with the way out. A lost connection isn't a failed run: the work may still
 * be going on, so the way out follows it again. A failed or never-started run is started again,
 * when the learner asks. `GenerationWait` shows it in place of its bar; a host that only knows
 * the content failed (no run to show phases of) shows it alone.
 */
export function GenerationFailureNotice({
  failure,
  retry,
}: {
  failure: GenerationFailure;
  retry?: () => void;
}) {
  const t = useExtracted();

  const copy = {
    connection: {
      action: t("Reconnect"),
      description: t("We stopped getting updates. It may still be working."),
      title: t("Connection lost"),
    },
    generation: {
      action: t("Try again"),
      description: t("Something went wrong on our side."),
      title: t("This didn't finish"),
    },
    notStarted: {
      action: t("Try again"),
      description: t("We couldn't get this started."),
      title: t("This didn't start"),
    },
  }[failure];

  return (
    <Alert variant={failure === "connection" ? "default" : "destructive"}>
      <FailureIcon failure={failure} />
      <AlertTitle>{copy.title}</AlertTitle>
      <AlertDescription>{copy.description}</AlertDescription>
      {retry && (
        <Button
          className="text-foreground col-start-2 mt-3 justify-self-start"
          onClick={retry}
          size="sm"
          variant="outline"
        >
          {copy.action}
        </Button>
      )}
    </Alert>
  );
}

/** Screen readers hear each phase once as it starts, then that it's done. */
function useAnnouncement({
  copy,
  progress,
  run,
}: {
  copy: Record<string, PhaseCopy>;
  progress: PhaseProgress<string>;
  run: GenerationRun;
}): string {
  const t = useExtracted();
  const active = progress.phases.find((phase) => phase.status === "active");

  if (progress.progress === 100) {
    return t("Done");
  }

  return isFollowing(run) && active ? (copy[active.id]?.label ?? "") : "";
}

/**
 * Every generation wait: the host's title and description, a progress bar that keeps moving at
 * the pace the work usually takes, and the run's phases as they happen, the running one saying
 * what it's doing. When it stops, it says why (a lost connection or a failed run) with the way
 * out. The host follows the run (`run`) and moves on by itself once it's ready.
 */
export function GenerationWait({
  children,
  className,
  kind,
  run,
}: {
  /** The host's title and description: what is being made for this learner. */
  children?: React.ReactNode;
  className?: string;
  kind: GenerationKind;
  run: GenerationRun;
}) {
  const copy = useGenerationCopy(kind);
  const progress = getPhaseProgress({ definition: getGenerationKind(kind), run });
  const announcement = useAnnouncement({ copy: copy.phases, progress, run });
  const failure = run.status === "failed" ? (run.failure ?? "generation") : null;

  return (
    <GenerationTimeline
      className={className}
      data-paused={failure === "connection" ? "" : undefined}
    >
      <GenerationTimelineHeader>
        {children}
        {failure ? (
          <GenerationFailureNotice failure={failure} retry={run.retry} />
        ) : (
          <WaitProgress label={copy.name} progress={progress} run={run} />
        )}
      </GenerationTimelineHeader>

      <GenerationTimelineStatus>{announcement}</GenerationTimelineStatus>

      <GenerationTimelineSteps aria-label={copy.name}>
        {progress.phases.map((phase) => {
          const phaseText = copy.phases[phase.id];

          return (
            <GenerationTimelineStep key={phase.id} status={phase.status}>
              <GenerationTimelineStepIndicator />
              <GenerationTimelineStepLabel>
                {phaseText?.label}
                <PhaseStatusText status={phase.status} />
              </GenerationTimelineStepLabel>
              {phase.status === "active" && isFollowing(run) && phaseText && (
                <ActiveDetail copy={phaseText} phase={phase.id} />
              )}
            </GenerationTimelineStep>
          );
        })}
      </GenerationTimelineSteps>
    </GenerationTimeline>
  );
}

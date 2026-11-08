"use client";

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
  GenerationTimelineStepTime,
  GenerationTimelineSteps,
} from "@zoonk/ui/components/generation-timeline";
import { useAnimatedProgress } from "@zoonk/ui/hooks/animated-progress";
import { useTickCount } from "@zoonk/ui/hooks/tick-count";
import { CircleAlertIcon, WifiOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import {
  NoticeCard,
  NoticeCardActions,
  NoticeCardContent,
  NoticeCardDescription,
  NoticeCardLeading,
  NoticeCardTitle,
} from "../_components/notice-card";
import { formatClock } from "../_utils/clock";
import { useAppLocale } from "../_utils/locale";
import { getDetailLine } from "./_utils/detail-line";
import { type PhaseProgress, type PhaseStatus, getPhaseProgress } from "./_utils/phase-progress";
import { type PhaseTime, getPhaseTimes } from "./_utils/phase-times";
import { type PhaseCopy } from "./generation-copy-types";
import { type GenerationKind, getGenerationKind } from "./generation-kinds";
import { type GenerationFailure, type GenerationRun } from "./generation-run";
import { useGenerationCopy } from "./use-generation-copy";

function isFollowing(run: GenerationRun): boolean {
  return run.status === "waiting" || run.status === "following";
}

/**
 * The run's progress from 0 to 100, drifting through the running phase. Bars given the same `since`
 * show the same value, wherever on the screen they are.
 */
/**
 * The bar drifts from when the running stage started, as the run reported it, so a page loaded
 * partway through goes on from there; `since` (when the screen opened) stands in until it's known.
 */
export function useGenerationProgress({
  kind,
  run,
  since,
}: {
  kind: GenerationKind;
  run: GenerationRun;
  since?: number;
}): number {
  const progress = getPhaseProgress({ definition: getGenerationKind(kind), run });

  return useAnimatedProgress({
    active: isFollowing(run),
    estimatedMs: progress.activeMs,
    progress: progress.progress,
    since: progress.activeSince ?? since,
    target: progress.target,
  });
}

/** The bar re-renders on its own as it drifts, so the rows don't. */
function WaitProgress({
  kind,
  label,
  run,
  since,
  weights,
}: {
  kind: GenerationKind;
  label: string;
  run: GenerationRun;
  since?: number;
  weights: number[];
}) {
  const locale = useAppLocale();
  const value = useGenerationProgress({ kind, run, since });

  return (
    <GenerationTimelineProgress
      aria-label={label}
      locale={locale}
      value={value}
      weights={weights}
    />
  );
}

function ActiveDetail({
  copy,
  phase,
  skillName,
}: {
  copy: PhaseCopy;
  phase: string;
  skillName?: string;
}) {
  const tick = useTickCount({ resetKey: phase });
  const line = getDetailLine({ lines: copy.lines, numbered: copy.numbered, tick });

  if (skillName) {
    return (
      <GenerationTimelineStepDetail className="truncate">{skillName}</GenerationTimelineStepDetail>
    );
  }

  return line ? (
    <GenerationTimelineStepDetail key={line}>{line}</GenerationTimelineStepDetail>
  ) : null;
}

const SECOND_MS = 1000;

function RunningTime({ offsetMs, startedAt }: { offsetMs: number; startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), SECOND_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <GenerationTimelineStepTime aria-hidden="true">
      {formatClock(Math.max(0, now - offsetMs - startedAt))}
    </GenerationTimelineStepTime>
  );
}

function PhaseTimeText({
  following,
  offsetMs,
  status,
  time,
}: {
  following: boolean;
  offsetMs?: number;
  status: PhaseStatus;
  time?: PhaseTime;
}) {
  if (!time || time.startedAt === null) {
    return null;
  }

  if (status === "completed" && time.endedAt !== null) {
    return (
      <GenerationTimelineStepTime aria-hidden="true">
        {formatClock(Math.max(0, time.endedAt - time.startedAt))}
      </GenerationTimelineStepTime>
    );
  }

  return status === "active" && following && offsetMs !== undefined ? (
    <RunningTime offsetMs={offsetMs} startedAt={time.startedAt} />
  ) : null;
}

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
      title: t({
        description: "Preparing this content failed. It is not still running.",
        message: "This didn't finish",
      }),
    },
    notStarted: {
      action: t("Try again"),
      description: t("We couldn't get this started."),
      title: t("This didn't start"),
    },
  }[failure];

  return (
    <NoticeCard role="alert">
      <NoticeCardLeading className="text-muted-foreground">
        <FailureIcon failure={failure} />
      </NoticeCardLeading>
      <NoticeCardContent>
        <NoticeCardTitle>{copy.title}</NoticeCardTitle>
        <NoticeCardDescription>{copy.description}</NoticeCardDescription>
        {retry && (
          <NoticeCardActions>
            <Button onClick={retry} size="sm">
              {copy.action}
            </Button>
          </NoticeCardActions>
        )}
      </NoticeCardContent>
    </NoticeCard>
  );
}

function useAnnouncement({
  copy,
  doneLabel,
  progress,
  run,
}: {
  copy: Record<string, PhaseCopy>;
  doneLabel?: string;
  progress: PhaseProgress<string>;
  run: GenerationRun;
}): string {
  const t = useExtracted();
  const active = progress.phases.find((phase) => phase.status === "active");

  if (progress.progress === 100) {
    return doneLabel ?? t("Done");
  }

  return isFollowing(run) && active ? (copy[active.id]?.label ?? "") : "";
}

export function GenerationWait({
  children,
  className,
  doneLabel,
  kind,
  run,
  since,
}: {
  children?: React.ReactNode;
  className?: string;
  /** What the status line says once it's done, for a screen that stays then. */
  doneLabel?: string;
  kind: GenerationKind;
  run: GenerationRun;
  /** When the wait began on this device, for a screen that takes over a wait another one showed. */
  since?: number;
}) {
  const copy = useGenerationCopy(kind);
  const definition = getGenerationKind(kind);
  const progress = getPhaseProgress({ definition, run });

  const times = getPhaseTimes({
    definition,
    phases: progress.phases,
    stepTimes: run.stepTimes ?? {},
  });

  const announcement = useAnnouncement({ copy: copy.phases, doneLabel, progress, run });
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
          <WaitProgress
            kind={kind}
            label={copy.name}
            run={run}
            since={since}
            weights={progress.phases.map((phase) => phase.seconds)}
          />
        )}
      </GenerationTimelineHeader>

      <GenerationTimelineStatus>{announcement}</GenerationTimelineStatus>

      <GenerationTimelineSteps aria-label={copy.name}>
        {progress.phases.map((phase, index) => {
          const phaseText = copy.phases[phase.id];

          return (
            <GenerationTimelineStep key={phase.id} status={phase.status}>
              <GenerationTimelineStepIndicator />
              <GenerationTimelineStepLabel>
                {phaseText?.label}
                <PhaseStatusText status={phase.status} />
              </GenerationTimelineStepLabel>
              <PhaseTimeText
                following={isFollowing(run)}
                offsetMs={run.clockOffsetMs}
                status={phase.status}
                time={times[index]}
              />
              {phase.status === "active" && isFollowing(run) && phaseText && (
                <ActiveDetail
                  copy={phaseText}
                  phase={phase.id}
                  skillName={
                    phase.id === definition.steps.buildSkillGraph ? run.skillName : undefined
                  }
                />
              )}
            </GenerationTimelineStep>
          );
        })}
      </GenerationTimelineSteps>
    </GenerationTimeline>
  );
}

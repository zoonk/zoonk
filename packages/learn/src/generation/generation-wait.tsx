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
import { useExtracted, useLocale } from "next-intl";
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

  return (
    <GenerationTimelineProgress
      aria-label={label}
      locale={locale}
      value={value}
      weights={progress.phases.map((phase) => phase.seconds)}
    />
  );
}

function ActiveDetail({ copy, phase }: { copy: PhaseCopy; phase: string }) {
  const tick = useTickCount({ resetKey: phase });
  const line = getDetailLine({ lines: copy.lines, numbered: copy.numbered, tick });

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

export function GenerationWait({
  children,
  className,
  kind,
  run,
}: {
  children?: React.ReactNode;
  className?: string;
  kind: GenerationKind;
  run: GenerationRun;
}) {
  const copy = useGenerationCopy(kind);
  const definition = getGenerationKind(kind);
  const progress = getPhaseProgress({ definition, run });

  const times = getPhaseTimes({
    definition,
    phases: progress.phases,
    stepTimes: run.stepTimes ?? {},
  });

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
                <ActiveDetail copy={phaseText} phase={phase.id} />
              )}
            </GenerationTimelineStep>
          );
        })}
      </GenerationTimelineSteps>
    </GenerationTimeline>
  );
}

"use client";

import {
  GenerationTimeline,
  GenerationTimelineHeader,
  GenerationTimelineProgress,
  GenerationTimelineStatus,
  GenerationTimelineStep,
  GenerationTimelineStepIndicator,
  GenerationTimelineStepLabel,
  GenerationTimelineSteps,
} from "@zoonk/ui/components/generation-timeline";
import { useAnimatedProgress } from "@zoonk/ui/hooks/animated-progress";
import { useExtracted } from "next-intl";
import { useAppLocale } from "../../_utils/locale";
import { GenerationFailureNotice } from "../../generation/generation-wait";
import { type PlanNext, PlanReadyHeading } from "./plan-building";
import { WaitHeading } from "./wait-parts";
import { type WaitStop } from "./wait-run";

/** Reading a notice and fitting it into the plan usually takes about four minutes. */
const READING_MS = 240_000;

const PLAN_BUILT_PROGRESS = 40;

const PHASE_WEIGHTS = [PLAN_BUILT_PROGRESS, 100 - PLAN_BUILT_PROGRESS];

function getReadingStatus({ holding, stop }: { holding: boolean; stop: WaitStop | null }) {
  if (holding) {
    return "completed";
  }

  return stop?.failure === "generation" ? "failed" : "active";
}

/** Bars given the same `since` show the same value, wherever on the screen they are. */
export function useNoticeProgress({
  holding,
  since,
  stopped,
}: {
  holding: boolean;
  since: number;
  stopped: WaitStop | null;
}): number {
  return useAnimatedProgress({
    active: !holding && !stopped,
    estimatedMs: READING_MS,
    progress: holding ? 100 : PLAN_BUILT_PROGRESS,
    since,
    target: 100,
  });
}

export function useNoticeTitle(): string {
  const t = useExtracted();
  return t("Reading your exam's official documents");
}

export function NoticeReading({
  holding,
  next,
  since,
  stopped,
}: {
  holding: boolean;
  next: PlanNext;
  since: number;
  stopped: WaitStop | null;
}) {
  const t = useExtracted();
  const locale = useAppLocale();
  const stop = holding ? null : stopped;
  const title = useNoticeTitle();
  const value = useNoticeProgress({ holding, since, stopped: stop });

  return (
    <GenerationTimeline data-paused={stop ? "" : undefined}>
      <GenerationTimelineHeader>
        {holding ? (
          <PlanReadyHeading next={next} />
        ) : (
          <WaitHeading description={t("This takes a few minutes.")} title={title} />
        )}

        {stop ? (
          <GenerationFailureNotice failure={stop.failure} retry={stop.retry} />
        ) : (
          <GenerationTimelineProgress
            aria-label={title}
            locale={locale}
            value={value}
            weights={PHASE_WEIGHTS}
          />
        )}
      </GenerationTimelineHeader>

      <GenerationTimelineStatus>{holding ? t("Your plan is ready") : ""}</GenerationTimelineStatus>

      <GenerationTimelineSteps aria-label={title}>
        <GenerationTimelineStep status="completed">
          <GenerationTimelineStepIndicator />
          <GenerationTimelineStepLabel>
            {t("Your plan, from what you told us")}
          </GenerationTimelineStepLabel>
        </GenerationTimelineStep>

        <GenerationTimelineStep status={getReadingStatus({ holding, stop })}>
          <GenerationTimelineStepIndicator />
          <GenerationTimelineStepLabel>
            {t("Reading the official documents")}
          </GenerationTimelineStepLabel>
        </GenerationTimelineStep>
      </GenerationTimelineSteps>
    </GenerationTimeline>
  );
}

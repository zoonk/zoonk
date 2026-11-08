"use client";

import { type ExamDocument } from "@zoonk/core/exams/document";
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
import { useExtracted } from "next-intl";
import { useAppLocale } from "../../_utils/locale";
import { getDetailLine } from "../../generation/_utils/detail-line";
import { GenerationFailureNotice } from "../../generation/generation-wait";
import { type PlanNext, PlanReadyHeading } from "./plan-building";
import { WaitHeading } from "./wait-parts";
import { type WaitStop } from "./wait-run";

/** Reading a notice and fitting it into the plan usually takes about four minutes. */
const READING_MS = 240_000;

const PLAN_BUILT_PROGRESS = 40;

const PHASE_WEIGHTS = [PLAN_BUILT_PROGRESS, 100 - PLAN_BUILT_PROGRESS];

function ReadingDetail({ document }: { document: ExamDocument }) {
  const t = useExtracted();
  const tick = useTickCount({ resetKey: "notice" });

  const line = getDetailLine({
    lines: [
      t(
        "{document, select, notice {Finding the subjects and topics the notice lists…} other {Finding the parts and topics the official guide lists…}}",
        { document },
      ),
      t("Checking the exam's dates and format…"),
      t("Fitting them into your plan…"),
    ],
    tick,
  });

  return line ? (
    <GenerationTimelineStepDetail key={line}>{line}</GenerationTimelineStepDetail>
  ) : null;
}

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

export function useNoticeTitle(lastNotice: boolean): string {
  const t = useExtracted();

  return lastNotice
    ? t("Reading the last edition's official documents")
    : t("Reading the exam's official documents");
}

export function NoticeReading({
  document,
  holding,
  lastNotice,
  next,
  since,
  stopped,
}: {
  document: ExamDocument;
  holding: boolean;
  lastNotice: boolean;
  next: PlanNext;
  since: number;
  stopped: WaitStop | null;
}) {
  const t = useExtracted();
  const locale = useAppLocale();
  const stop = holding ? null : stopped;
  const reading = !holding && !stop;
  const title = useNoticeTitle(lastNotice);
  const value = useNoticeProgress({ holding, since, stopped: stop });

  return (
    <GenerationTimeline data-paused={stop ? "" : undefined}>
      <GenerationTimelineHeader>
        {holding ? (
          <PlanReadyHeading next={next} />
        ) : (
          <WaitHeading
            description={
              lastNotice
                ? t(
                    "The next edition's documents aren't out yet, so your plan follows the last one's subjects and topics. We'll tell you when the new ones are out. This usually takes a few minutes.",
                  )
                : t(
                    "{document, select, notice {Your plan will follow the notice's subjects, topics and dates.} other {Your plan will follow the official guide's parts, topics and dates.}} This usually takes a few minutes.",
                    { document },
                  )
            }
            title={title}
          />
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
          {reading && <ReadingDetail document={document} />}
        </GenerationTimelineStep>
      </GenerationTimelineSteps>
    </GenerationTimeline>
  );
}

export function UsualStructureNote() {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground text-xs text-pretty">
      {t(
        "This plan follows the exam's usual structure while we finish reading its official documents. If they change your plan, you'll decide on Today.",
      )}
    </p>
  );
}

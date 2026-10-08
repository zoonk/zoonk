"use client";

import {
  GenerationTimeline,
  GenerationTimelineHeader,
  GenerationTimelineProgress,
  GenerationTimelineStep,
  GenerationTimelineStepDetail,
  GenerationTimelineStepIndicator,
  GenerationTimelineStepLabel,
  GenerationTimelineSteps,
} from "@zoonk/ui/components/generation-timeline";
import { useAnimatedProgress } from "@zoonk/ui/hooks/animated-progress";
import { useTickCount } from "@zoonk/ui/hooks/tick-count";
import { FileClockIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { Callout } from "../../_components/callout";
import { useFormatIsoDate } from "../../_utils/iso-date";
import { getDetailLine } from "../../generation/_utils/detail-line";
import {
  OnboardingColumn,
  OnboardingDescription,
  OnboardingHeading,
  OnboardingTitle,
} from "../onboarding-frame";

/** Reading a notice and fitting it into the plan usually takes about four minutes. */
const READING_MS = 240_000;

/** The plan is built; the bar starts where the reading does. */
const PLAN_BUILT_PROGRESS = 40;

/** The reading's line changes every few seconds, so the wait shows what's going on. */
function ReadingDetail() {
  const t = useExtracted();
  const tick = useTickCount({ active: true, resetKey: "notice" });

  const line = getDetailLine({
    lines: [
      t("Finding the subjects and topics it lists…"),
      t("Checking the exam's dates and format…"),
      t("Fitting the notice into your plan…"),
    ],
    tick,
  });

  return line ? (
    <GenerationTimelineStepDetail key={line}>{line}</GenerationTimelineStepDetail>
  ) : null;
}

/**
 * The reveal while research reads the exam's notice: the plan is built from what the learner told
 * us, and the notice's subjects, topics and dates go into it before they see it. The host keeps
 * checking and shows the plan once the reading lands, or once the wait runs out. While the next
 * edition's notice isn't out (`lastNotice`), it reads the last one, and says so.
 */
export function NoticeReading({ lastNotice }: { lastNotice: boolean }) {
  const t = useExtracted();
  const locale = useLocale();
  const title = lastNotice ? t("Reading the last exam notice") : t("Reading the exam notice");

  const value = useAnimatedProgress({
    active: true,
    estimatedMs: READING_MS,
    progress: PLAN_BUILT_PROGRESS,
    target: 100,
  });

  return (
    <OnboardingColumn>
      <GenerationTimeline>
        <GenerationTimelineHeader>
          <OnboardingHeading>
            <OnboardingTitle>{title}</OnboardingTitle>
            <OnboardingDescription>
              {lastNotice
                ? t(
                    "The next notice isn't out yet, so your plan follows the last one's subjects and topics. We'll tell you when the new one is out. This usually takes a few minutes.",
                  )
                : t(
                    "Your plan will follow its subjects, topics and dates. This usually takes a few minutes.",
                  )}
            </OnboardingDescription>
          </OnboardingHeading>

          <GenerationTimelineProgress aria-label={title} locale={locale} value={value} />
        </GenerationTimelineHeader>

        <GenerationTimelineSteps aria-label={title}>
          <GenerationTimelineStep status="completed">
            <GenerationTimelineStepIndicator />
            <GenerationTimelineStepLabel>
              {t("Your plan, from what you told us")}
            </GenerationTimelineStepLabel>
          </GenerationTimelineStep>

          <GenerationTimelineStep status="active">
            <GenerationTimelineStepIndicator />
            <GenerationTimelineStepLabel>{t("Reading the notice")}</GenerationTimelineStepLabel>
            <ReadingDetail />
          </GenerationTimelineStep>
        </GenerationTimelineSteps>
      </GenerationTimeline>
    </OnboardingColumn>
  );
}

/**
 * A plan revealed before its notice was read follows the exam's usual structure, and says so: the
 * reading arrives on Today as a change the learner applies or not.
 */
export function UsualStructureNote() {
  const t = useExtracted();

  return (
    <Callout>
      <FileClockIcon aria-hidden="true" />
      <p>
        {t(
          "This plan follows the exam's usual structure while we finish reading its notice. If the notice changes your plan, you'll decide on Today.",
        )}
      </p>
    </Callout>
  );
}

/**
 * The exam's day from its notice, when it isn't the one the learner gave (another month than the
 * one they said, "in March"): the plan keeps theirs, and the notice's day waits on Today for their
 * choice, since they may mean another sitting.
 */
export function NoticeDateNote({ isoDate }: { isoDate: string }) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return (
    <Callout>
      <FileClockIcon aria-hidden="true" />
      <p>
        {t(
          "The exam notice puts the exam on {date}. You'll choose on Today which date your plan follows.",
          { date: formatDate(isoDate, "long") },
        )}
      </p>
    </Callout>
  );
}

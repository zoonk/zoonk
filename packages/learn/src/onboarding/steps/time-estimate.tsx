"use client";

import { type PlanTimeAdvice } from "@zoonk/core/plans/time-advice-contract";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { CoverageBar } from "../../_components/coverage-bar";
import { SURFACE_CLASS } from "../../_components/surface";
import { useFormatGoalDate } from "../../_utils/iso-date";
import { useFormatDuration } from "../../_utils/time-format";
import { OnboardingRailSection } from "../onboarding-rail";

/**
 * The share, large in the mono face, where the estimate's sentence puts it (first in English; a
 * translation can put words before it, so the sentence flows around it as text).
 */
function ShareNumber(chunks: React.ReactNode) {
  return (
    <span className="text-foreground mr-1.5 font-mono text-[1.375rem] leading-none font-medium tracking-[-0.03em] tabular-nums">
      {chunks}
    </span>
  );
}

/**
 * What the share is of, by the goal's date: the plan's exam topics (the curriculum the plan holds,
 * weighed by the exam, never claimed as the whole exam), what comes up most first, or the goal,
 * what matters most first. The course's page says the same share the same way. All of it reads as
 * all of it, not "about 100%".
 */
function EstimateWords({ advice, share }: { advice: PlanTimeAdvice; share: number }) {
  const t = useExtracted();
  const format = useFormatter();
  const formatGoalDate = useFormatGoalDate();

  const values = {
    date: advice.targetDate
      ? formatGoalDate({ isoDate: advice.targetDate, namedMonth: advice.targetDateNamedMonth })
      : "",
    number: ShareNumber,
    share: format.number(share, { maximumFractionDigits: 0, style: "percent" }),
  };

  if (share >= 1) {
    return advice.measure === "exam"
      ? t.rich("<number>{share}</number> of the plan's exam topics in depth by {date}.", values)
      : t.rich("<number>{share}</number> of your goal in depth by {date}.", values);
  }

  return advice.measure === "exam"
    ? t.rich(
        "<number>~{share}</number> of the plan's exam topics in depth by {date}, what comes up most first.",
        values,
      )
    : t.rich(
        "<number>~{share}</number> of your goal in depth by {date}, what matters most first.",
        values,
      );
}

/** Asking what the time picked covers stopped: it says so, with the way to ask again. */
function EstimateFailure({ minutes, onRetry }: { minutes: number; onRetry: () => void }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (
    <p className="text-foreground text-sm text-pretty">
      {t("We couldn't work out what {time} a day covers.", { time: formatDuration(minutes) })}{" "}
      <button className="font-medium underline underline-offset-4" onClick={onRetry} type="button">
        {t("Try again")}
      </button>
    </p>
  );
}

/** The share's sentence, or its place while the first one is on its way. */
function EstimateShare({ advice, share }: { advice: PlanTimeAdvice | null; share: number | null }) {
  const t = useExtracted();

  if (advice && share !== null) {
    return (
      <p>
        <EstimateWords advice={advice} share={share} />
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-5.5 w-14 shrink-0" />
      <p>{t("Working out what your time covers…")}</p>
    </div>
  );
}

/**
 * The time question's estimate: what the time a day picked covers by the goal's date, as a share,
 * what it's a share of, and the coverage bar. It follows each pick at once; while the plan works
 * out a time it hasn't said yet, the last share stays, dimmed (`stale`), and before the first one
 * the share's place waits in its shape. When asking stopped (`failed`), it isn't busy anymore: it
 * says so with a retry (`retry`), and names the time the share it kept was for.
 */
function EstimateBody({
  advice,
  failed,
  minutes,
  onRetry,
  retry,
  share,
  stale,
  staleMinutes,
}: TimeEstimateProps) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (
    <div aria-busy={!failed && (stale || share === null)} className="flex flex-col gap-3">
      <div
        aria-live="polite"
        className="text-muted-foreground flex flex-col gap-2 text-sm leading-6 text-pretty"
      >
        {retry && <EstimateFailure minutes={minutes} onRetry={onRetry} />}

        {(!failed || share !== null) && (
          <div
            className={cn(
              "flex flex-col transition-opacity duration-150 motion-reduce:transition-none",
              stale && "opacity-60",
            )}
          >
            {failed && staleMinutes !== null && (
              <p className="text-xs">
                {t("Last estimate, for {time} a day", { time: formatDuration(staleMinutes) })}
              </p>
            )}

            <EstimateShare advice={advice} share={share} />
          </div>
        )}
      </div>

      <CoverageBar className={cn(stale && "opacity-60")} known={0} studied={share ?? 0} />
    </div>
  );
}

type TimeEstimateProps = {
  /** The plan's advice for the week shown; null until it says it. */
  advice: PlanTimeAdvice | null;
  /** Asking what the time picked covers stopped. */
  failed: boolean;
  /** The time a day picked. */
  minutes: number;
  onRetry: () => void;
  /** The estimate says asking stopped, with its retry (the sentence above doesn't). */
  retry: boolean;
  /** What the time picked covers; the last share known while a new one is asked (`stale`). */
  share: number | null;
  stale: boolean;
  /** The time a day the kept share was for. */
  staleMinutes: number | null;
};

/**
 * The estimate on the screen, under the time chips and above what the learner would need, until
 * the page's aside shows it from 72rem: one panel, the only one there.
 */
export function TimeEstimatePanel(props: TimeEstimateProps) {
  const t = useExtracted();

  return (
    <OnboardingRailSection
      className={cn(SURFACE_CLASS, "gap-3 p-4 min-[72rem]:hidden")}
      id="onboarding-estimate-panel"
      title={t("Estimate")}
    >
      <EstimateBody {...props} />
    </OnboardingRailSection>
  );
}

/** The estimate at the top of the page's aside from 72rem, beside the time chips it follows. */
export function TimeEstimateSection(props: TimeEstimateProps) {
  const t = useExtracted();

  return (
    <OnboardingRailSection className="gap-3" id="onboarding-estimate" title={t("Estimate")}>
      <EstimateBody {...props} />
    </OnboardingRailSection>
  );
}

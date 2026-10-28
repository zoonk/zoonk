"use client";

import { type PlanTimeAdvice } from "@zoonk/core/plans/time-advice-contract";
import { Button } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { CoverageBar } from "../../_components/coverage-bar";
import { SURFACE_CLASS } from "../../_components/surface";
import { useFormatGoalDate } from "../../_utils/iso-date";
import { useFormatDuration } from "../../_utils/time-format";
import { OnboardingRailSection } from "../onboarding-rail";

function ShareNumber(chunks: React.ReactNode) {
  return (
    <span className="text-foreground mr-1.5 font-mono text-[1.375rem] leading-none font-medium tracking-[-0.03em] tabular-nums">
      {chunks}
    </span>
  );
}

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

function EstimateFailure({ minutes, onRetry }: { minutes: number; onRetry: () => void }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (
    <p className="text-foreground text-sm text-pretty">
      {t("We couldn't work out what {time} a day covers.", { time: formatDuration(minutes) })}{" "}
      <Button onClick={onRetry} variant="link">
        {t("Try again")}
      </Button>
    </p>
  );
}

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
  advice: PlanTimeAdvice | null;
  failed: boolean;
  minutes: number;
  onRetry: () => void;
  retry: boolean;
  share: number | null;
  stale: boolean;
  staleMinutes: number | null;
};

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

export function TimeEstimateSection(props: TimeEstimateProps) {
  const t = useExtracted();

  return (
    <OnboardingRailSection className="gap-3" id="onboarding-estimate" title={t("Estimate")}>
      <EstimateBody {...props} />
    </OnboardingRailSection>
  );
}

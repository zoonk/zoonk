"use client";

import { getRecommendedTime } from "@zoonk/core/plans/time-advice-contract";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";
import { usePlanScreen } from "./plan-context";
import { PlanFailedMessage } from "./plan-failed-message";
import { usePlanChange } from "./use-plan-change";

/** Below half a percent, the share would read "0%". */
const MIN_SHOWN_SHARE = 0.005;

/**
 * The daily time a plan that doesn't cover the whole goal can switch to: the one time plans
 * recommend (`getRecommendedTime`), the same number the time step said.
 */
type CoverageTarget = NonNullable<ReturnType<typeof getRecommendedTime>>;

/**
 * How far the learner's time goes before their date, and the daily time worth switching to. Null
 * when the plan covers everything in depth or has no date to cover it by.
 */
export function usePlanCoverage() {
  const { plan } = usePlanScreen();
  const { feasibility } = plan;

  if (!feasibility?.deadline || feasibility.fits) {
    return null;
  }

  return {
    coreFits: feasibility.coreFits,
    coveredShare: feasibility.coveredShare,
    measure: feasibility.measure,
    target: getRecommendedTime(feasibility),
  };
}

type Coverage = NonNullable<ReturnType<typeof usePlanCoverage>>;

/**
 * What the learner's own time covers: every topic (for an exam, of the exam; for any other goal,
 * every part of it), the ones that count most in more depth; or, when even that doesn't fit, that
 * the ones that count least wait.
 */
export function useCoveredText() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { plan } = usePlanScreen();
  const time = formatDuration(plan.schedule.dailyMinutes);

  return ({
    coreFits,
    coveredShare,
    measure,
  }: Pick<Coverage, "coreFits" | "coveredShare" | "measure">): string => {
    // Next to nothing fits: a sentence about depth would say nothing a learner can use.
    if (coveredShare < MIN_SHOWN_SHARE) {
      return t("{time} a day isn't enough time to cover your goal.", { time });
    }

    if (coreFits) {
      return measure === "exam"
        ? t(
            "{time} a day studies every topic of the exam, the ones that come up most in more depth.",
            { time },
          )
        : t(
            "{time} a day studies every part of your goal, the ones that matter most in more depth.",
            { time },
          );
    }

    return measure === "exam"
      ? t("{time} a day doesn't reach every topic: the ones that come up least are left out.", {
          time,
        })
      : t(
          "{time} a day doesn't reach every part of your goal: the ones that matter least are left out.",
          { time },
        );
  };
}

export function CoveredSentence(props: Pick<Coverage, "coreFits" | "coveredShare" | "measure">) {
  const coveredText = useCoveredText();
  return <p>{coveredText(props)}</p>;
}

/** The time worth switching to, and what it does. */
export function useTargetText() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (target: CoverageTarget): string => {
    const time = formatDuration(target.dailyMinutes);

    switch (target.kind) {
      case "inDepth":
        return t("To study everything in depth: {time} a day.", { time });
      case "more":
        return t("At {time} a day, more of it in depth.", { time });
      default:
        return target.kind satisfies never;
    }
  };
}

export function TargetSentence({ target }: { target: CoverageTarget }) {
  const targetText = useTargetText();
  return <p className="font-semibold">{targetText(target)}</p>;
}

/**
 * One tap to the daily time worth switching to; the plan re-plans from today and shows it.
 * `onSwitched` hears when the switch was saved.
 */
export function CoverageSwitch({
  onSwitched,
  target,
  variant = "outline",
}: {
  onSwitched?: () => void;
  target: CoverageTarget;
  variant?: "outline" | "secondary";
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { change, failed, isPending } = usePlanChange();

  const switchTime = async () => {
    const outcome = await change([{ kind: "setDailyMinutes", minutes: target.dailyMinutes }]);

    if (outcome?.status === "applied") {
      onSwitched?.();
    }
  };

  return (
    <>
      <Button
        className="self-start"
        disabled={isPending}
        focusableWhenDisabled
        onClick={() => void switchTime()}
        size="sm"
        variant={variant}
      >
        {t("Switch to {time} a day", { time: formatDuration(target.dailyMinutes) })}
      </Button>
      {failed && <PlanFailedMessage />}
    </>
  );
}

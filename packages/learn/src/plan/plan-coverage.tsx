"use client";

import { getRecommendedTime } from "@zoonk/core/plans/time-advice-contract";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatShare } from "../_utils/percent";
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
 * How far the learner's time goes before their date, the daily time worth switching to, and, when
 * no daily time covers a goal that isn't an exam, the earliest date their time covers it by
 * (`fittingDate`). Null when the plan covers everything in depth or has no date to cover it by.
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
    deepensMostAsked: feasibility.deepensMostAsked,
    fittingDate: feasibility.fittingDate,
    measure: feasibility.measure,
    target: getRecommendedTime(feasibility),
  };
}

type Coverage = NonNullable<ReturnType<typeof usePlanCoverage>>;

type CoveredProps = Pick<Coverage, "coreFits" | "coveredShare" | "deepensMostAsked" | "measure">;

/**
 * What the learner's own time covers: every topic (for an exam, of the exam; for any other goal,
 * every part of it), the ones that count most in more depth (for an exam, only when the topics it
 * asks most really keep more of theirs); or, when even that doesn't fit, what the plan's cut
 * leaves out: an exam's least asked topics, and for any other goal what its path reaches last.
 */
export function useCoveredText() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { plan } = usePlanScreen();
  const time = formatDuration(plan.schedule.dailyMinutes);

  return ({ coreFits, coveredShare, deepensMostAsked, measure }: CoveredProps): string => {
    // Next to nothing fits: a sentence about depth would say nothing a learner can use.
    if (coveredShare < MIN_SHOWN_SHARE) {
      return t("{time} a day isn't enough time to cover your goal.", { time });
    }

    if (coreFits && measure === "exam") {
      return deepensMostAsked
        ? t(
            "{time} a day studies every topic of the exam, the ones that come up most in more depth.",
            { time },
          )
        : t("{time} a day studies every topic of the exam, some of them in less depth.", { time });
    }

    if (coreFits) {
      return t(
        "{time} a day studies every part of your goal, the ones that matter most in more depth.",
        { time },
      );
    }

    return measure === "exam"
      ? t("{time} a day doesn't reach every topic: the ones that come up least are left out.", {
          time,
        })
      : t(
          "{time} a day doesn't reach every part of your goal: what comes last in your path is left out.",
          { time },
        );
  };
}

export function CoveredSentence(props: CoveredProps) {
  const coveredText = useCoveredText();
  return <p>{coveredText(props)}</p>;
}

/**
 * The time worth switching to, and what it does: everything in depth, or, when no daily time
 * covers the goal by its date, honestly how much of it the most time a day studies in depth. Both
 * say "in depth": the share is of everything there is to study, so it never reads against the
 * learner's own time studying every topic (Rafaela read "even at 4 h, about 80%" over "2 h a day
 * studies every topic").
 */
export function useTargetText() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const formatShare = useFormatShare();

  return (target: CoverageTarget): string => {
    const time = formatDuration(target.dailyMinutes);

    switch (target.kind) {
      case "inDepth":
        return t("To study everything in depth: {time} a day.", { time });
      case "more":
        return t(
          "Even at {time} a day, you'd study about {share} of everything in depth by your date.",
          { share: formatShare(target.coveredShare), time },
        );
      default:
        return target satisfies never;
    }
  };
}

/**
 * When the learner's own time a day covers everything, for a goal no daily time covers by its
 * date: the plan's notice and editor, and Today's card after days away, say it the same way.
 */
export function useFittingDateText() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const formatDate = useFormatIsoDate();

  return ({ dailyMinutes, fittingDate }: { dailyMinutes: number; fittingDate: string }): string =>
    t("At {time} a day, your plan covers everything by {date}.", {
      date: formatDate(fittingDate, "long"),
      time: formatDuration(dailyMinutes),
    });
}

export function TargetSentence({ target }: { target: CoverageTarget }) {
  const targetText = useTargetText();
  return <p className="font-semibold">{targetText(target)}</p>;
}

/**
 * One tap to the earliest date the learner's time covers everything by (see `usePlanCoverage`);
 * the plan re-plans from today and shows it. `onSwitched` hears when the move was saved.
 */
function MoveDateSwitch({
  fittingDate,
  onSwitched,
  variant,
}: {
  fittingDate: string;
  onSwitched?: () => void;
  variant: "outline" | "secondary";
}) {
  const t = useExtracted();
  const { change, failed, isPending } = usePlanChange();

  const moveDate = () =>
    change([{ kind: "setTargetDate", targetDate: fittingDate }], (outcome) => {
      if (outcome?.status === "applied") {
        onSwitched?.();
      }
    });

  return (
    <>
      <Button
        className="self-start"
        disabled={isPending}
        focusableWhenDisabled
        onClick={() => void moveDate()}
        size="sm"
        variant={variant}
      >
        {t("Move your date to cover everything")}
      </Button>
      {failed && <PlanFailedMessage />}
    </>
  );
}

/**
 * The one tap a plan that doesn't cover its goal offers: moving the date, when no daily time
 * covers it by then, else switching to the time that covers more. Nothing when neither applies.
 */
export function CoverageAction({
  coverage,
  onSwitched,
  variant = "outline",
}: {
  coverage: Coverage;
  onSwitched?: () => void;
  variant?: "outline" | "secondary";
}) {
  if (coverage.fittingDate) {
    return (
      <MoveDateSwitch
        fittingDate={coverage.fittingDate}
        onSwitched={onSwitched}
        variant={variant}
      />
    );
  }

  return coverage.target ? (
    <CoverageSwitch onSwitched={onSwitched} target={coverage.target} variant={variant} />
  ) : null;
}

/**
 * One tap to the daily time worth switching to; the plan re-plans from today and shows it.
 * `onSwitched` hears when the switch was saved.
 */
function CoverageSwitch({
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

  const switchTime = () =>
    change([{ kind: "setDailyMinutes", minutes: target.dailyMinutes }], (outcome) => {
      if (outcome?.status === "applied") {
        onSwitched?.();
      }
    });

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

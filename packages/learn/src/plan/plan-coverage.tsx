"use client";

import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useFormatDuration } from "../_utils/time-format";
import { usePlanScreen } from "./plan-context";
import { PlanFailedMessage } from "./plan-failed-message";
import { usePlanChange } from "./use-plan-change";
import { useRequestTimeToCover, useTimeToCover, useTimeToCoverTexts } from "./use-time-to-cover";

/** Below half a percent, the share would read "0%". */
const MIN_SHOWN_SHARE = 0.005;

/**
 * How far the learner's own time goes before their date, exactly as their plan has it. Null when
 * the plan covers everything in depth or has no date to cover it by. What other daily times or
 * dates would do is the learner's to ask for (see `useTimeToCover`).
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
    measure: feasibility.measure,
  };
}

/**
 * Whether the learner's own time already covers the whole goal by its date (`timeCovers`): what
 * the plan still leaves out comes at their time then (the plan's `fitOffer`), never as another
 * daily time.
 */
export function useTimeEnough(): boolean {
  const { plan } = usePlanScreen();
  return plan.feasibility?.timeCovers ?? false;
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
 * "Move your date to cover everything", for a goal that isn't an exam: one tap moves its date to
 * the earliest day the learner's own time covers everything by. That's the date Find found for
 * this plan when it found one; otherwise the tap finds it first, under the same pending state.
 * The plan then re-plans from today and shows its new date. `onSwitched` hears when the move was
 * saved.
 */
export function MoveDateSwitch({
  onSwitched,
  ref,
}: {
  onSwitched?: () => void;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  const t = useExtracted();
  const texts = useTimeToCoverTexts();
  const { answered } = useTimeToCover();
  const requestTime = useRequestTimeToCover();
  const { change, failed, isPending } = usePlanChange();
  const [finding, setFinding] = useState(false);
  const [outcome, setOutcome] = useState<"failed" | "noDate" | null>(null);
  const pending = finding || isPending;

  const moveDate = async () => {
    setOutcome(null);
    setFinding(true);
    const time = answered ?? (await requestTime());
    setFinding(false);

    if (!time?.fittingDate) {
      setOutcome(time ? "noDate" : "failed");
      return;
    }

    void change([{ kind: "setTargetDate", targetDate: time.fittingDate }], (saved) => {
      if (saved?.status === "applied") {
        onSwitched?.();
      }
    });
  };

  return (
    <>
      <Button
        aria-busy={pending || undefined}
        className="self-start"
        disabled={pending}
        focusableWhenDisabled
        onClick={() => void moveDate()}
        ref={ref}
        size="sm"
        variant="outline"
      >
        {pending && <Spinner aria-hidden="true" data-icon="inline-start" role="presentation" />}
        {t("Move your date to cover everything")}
      </Button>
      {(failed || outcome === "failed") && <PlanFailedMessage />}
      {outcome === "noDate" && (
        <p className="text-destructive-text text-sm" role="alert">
          {texts.noDate}
        </p>
      )}
    </>
  );
}

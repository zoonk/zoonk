"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatShare } from "../_utils/percent";
import { usePlanScreen } from "./plan-context";
import { PlanFailedMessage } from "./plan-failed-message";
import { usePlanChange } from "./use-plan-change";

/** Without a suggestion from the planner, "add time" offers a quarter of an hour more. */
const EXTRA_MINUTES_STEP = 15;

function BehindFix({ days, minutes }: { days: number; minutes: number }) {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground text-sm">
      {t(
        "{minutes, number} more minutes a day for {days, plural, one {# day} other {# days}} gets you back on track. Nothing is lost.",
        { days, minutes },
      )}
    </p>
  );
}

function FeasibilityNote() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const formatShare = useFormatShare();
  const { plan } = usePlanScreen();
  const { feasibility } = plan;

  if (!feasibility || feasibility.fits || !feasibility.deadline) {
    return null;
  }

  return (
    <p className="text-muted-foreground text-sm">
      {t("At {minutes, number} min a day, this plan covers {share} of your goal by {date}.", {
        date: formatDate(feasibility.deadline, "long"),
        minutes: plan.schedule.dailyMinutes,
        share: formatShare(feasibility.coveredShare),
      })}
    </p>
  );
}

/**
 * When the plan no longer fits: the learner decides between more time, a later date or a
 * smaller scope. Each choice is one tap and can be undone from the changes.
 */
function AdjustOptions({ onNarrowScope }: { onNarrowScope: () => void }) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const { plan } = usePlanScreen();
  const { change, failed, isPending } = usePlanChange();

  const minutes =
    plan.feasibility?.recommendedMinutes ?? plan.schedule.dailyMinutes + EXTRA_MINUTES_STEP;

  const newDate = plan.feasibility?.alternative?.endDate ?? plan.estimate.endDate;
  const { targetDate } = plan.schedule;

  // Only a later date helps: the plan's own end is never past a deadline it doesn't fit.
  const hasDate = Boolean(targetDate && newDate && newDate > targetDate);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={isPending}
          focusableWhenDisabled
          onClick={() => change([{ kind: "setDailyMinutes", minutes }])}
          size="sm"
          variant="outline"
        >
          {t("Study {minutes, number} min a day", { minutes })}
        </Button>

        {hasDate && newDate && (
          <Button
            disabled={isPending}
            focusableWhenDisabled
            onClick={() => change([{ kind: "setTargetDate", targetDate: newDate }])}
            size="sm"
            variant="outline"
          >
            {t("Move the date to {date}", { date: formatDate(newDate, "long") })}
          </Button>
        )}

        <Button
          disabled={isPending}
          focusableWhenDisabled
          onClick={onNarrowScope}
          size="sm"
          variant="outline"
        >
          {t("Cover less")}
        </Button>
      </div>

      {failed && <PlanFailedMessage />}
    </div>
  );
}

/** The fix for a small delay, or the choices when the plan needs adjusting. Nothing when on track. */
export function PlanAdjust({ onNarrowScope }: { onNarrowScope: () => void }) {
  const { plan } = usePlanScreen();
  const { status } = plan;

  if (status?.kind === "behind") {
    return <BehindFix days={status.days} minutes={status.extraMinutesPerDay} />;
  }

  if (status?.kind !== "needsAdjusting" && plan.feasibility?.fits !== false) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2" data-slot="plan-adjust">
      <FeasibilityNote />
      <AdjustOptions onNarrowScope={onNarrowScope} />
    </div>
  );
}

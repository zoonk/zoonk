"use client";

import { BigQuantity } from "@zoonk/ui/components/big-quantity";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { useExtracted } from "next-intl";
import { FinishReadout, Readout } from "../../_components/finish-readout";
import { daysUntilIsoDate } from "../../_utils/iso-date";
import { useFormatDuration } from "../../_utils/time-format";
import { getAimAhead } from "../../language-aim/aim-ahead";
import { usePlanScreen } from "../../plan/plan-context";
import { useStudyDaysText } from "../../plan/use-study-days-text";

/** A cell of the row of readouts, divided from the one before it. */
const CELL_CLASS = "py-3 ps-3 first:ps-0 sm:ps-4";

function useTimeLabel(): string {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const studyDaysText = useStudyDaysText();
  const { plan } = usePlanScreen();
  const { shape, weekdayMinutes } = plan.schedule;

  if (shape.weekend !== null) {
    return t("{time} on weekends", { time: formatDuration(shape.weekend) });
  }

  return weekdayMinutes.every((minutes) => minutes > 0)
    ? t("a day")
    : studyDaysText(weekdayMinutes);
}

function TimeReadout() {
  const formatDuration = useFormatDuration();
  const label = useTimeLabel();
  const { plan } = usePlanScreen();
  const { shape } = plan.schedule;

  return (
    <Readout className={CELL_CLASS} label={label}>
      <BigQuantity>{formatDuration(shape.weekdays)}</BigQuantity>
    </Readout>
  );
}

/** The days left to a date the learner has, else when the plan finishes (`FinishReadout`). */
function EndReadout() {
  const t = useExtracted();
  const today = useMountTime();
  const { goal, plan } = usePlanScreen();
  const { targetDate, targetDateEstimated } = plan.schedule;

  if (targetDate) {
    const days = daysUntilIsoDate({ isoDate: targetDate, today });

    return (
      <Readout
        className={CELL_CLASS}
        label={goal.kind === "exam" ? t("until the exam") : t("until your date")}
      >
        {targetDateEstimated ? (
          <>
            <span aria-hidden="true">
              <BigQuantity>
                {t("{days, plural, one {~# day} other {~# days}}", { days })}
              </BigQuantity>
            </span>
            <span className="sr-only">
              {t("{days, plural, one {About # day} other {About # days}}", { days })}
            </span>
          </>
        ) : (
          <BigQuantity>{t("{days, plural, one {# day} other {# days}}", { days })}</BigQuantity>
        )}
      </Readout>
    );
  }

  // Past the years a plan lays out, "10+ years" was said where the time was picked; the reveal
  // shows the plan, not that wait again.
  if (!plan.estimate.endDate) {
    return null;
  }

  return (
    <FinishReadout
      aim={getAimAhead(plan.languageAim)}
      className={CELL_CLASS}
      forecast={plan.estimate}
    />
  );
}

export function RevealReadouts() {
  return (
    <div className="grid auto-cols-fr grid-flow-col border-y [&>*+*]:border-s">
      <TimeReadout />
      <EndReadout />
    </div>
  );
}

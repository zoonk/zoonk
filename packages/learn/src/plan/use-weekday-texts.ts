"use client";

import { type PlanOperation } from "@zoonk/core/plans/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { useExtracted, useFormatter } from "next-intl";
import { isoDateToUtc, useFormatIsoDate } from "../_utils/iso-date";
import { toLabelCase } from "../_utils/label-case";
import { useFormatDuration } from "../_utils/time-format";

/** A Sunday, the first weekday as plans count them (0), to name weekdays by. */
const FIRST_SUNDAY = isoDateToUtc("2023-01-01").getTime();

/** The weekday's ISO day in the week of `FIRST_SUNDAY`, to name it in the viewer's language. */
function toWeekdayIsoDate(weekday: number): string {
  return new Date(FIRST_SUNDAY + weekday * MS_PER_DAY).toISOString().slice(0, "YYYY-MM-DD".length);
}

/** A change to some weekdays' time, as the plan now has it: "Sunday: rest day." */
export function useWeekdaySentence() {
  const t = useExtracted();
  const format = useFormatter();
  const formatDate = useFormatIsoDate();
  const formatDuration = useFormatDuration();

  return function weekdaySentence(
    operation: Extract<PlanOperation, { kind: "setWeekdayMinutes" }>,
  ): string {
    const days = toLabelCase(
      format.list(
        operation.weekdays.map((weekday) => formatDate(toWeekdayIsoDate(weekday), "weekday")),
        { type: "conjunction" },
      ),
    );

    return operation.minutes === 0
      ? t("{days}: rest day.", { days })
      : t("{days}: {time} a day.", { days, time: formatDuration(operation.minutes) });
  };
}

/** "Weekly mocks move to Saturday.": where a change to the learner's days moves them. */
export function useWeeklyEventsText() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function weeklyEventsText(effect: PlanChangeView["effect"]): string | null {
    const moved = effect?.weeklyEvents;

    if (!moved) {
      return null;
    }

    const day = formatDate(toWeekdayIsoDate(moved.after), "weekday");

    return moved.kind === "mock"
      ? t("Weekly mocks move to {day}.", { day })
      : t("Weekly challenges move to {day}.", { day });
  };
}

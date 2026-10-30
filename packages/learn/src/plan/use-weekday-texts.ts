"use client";

import { type PlanOperation } from "@zoonk/core/plans/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { toLabelCase } from "../_utils/label-case";
import { useFormatDuration } from "../_utils/time-format";
import { useFormatWeekday } from "../_utils/use-format-weekday";

export function useWeekdaySentence() {
  const t = useExtracted();
  const format = useFormatter();
  const formatWeekday = useFormatWeekday();
  const formatDuration = useFormatDuration();

  return function weekdaySentence(
    operation: Extract<PlanOperation, { kind: "setWeekdayMinutes" }>,
  ): string {
    const days = toLabelCase(
      format.list(
        operation.weekdays.map((weekday) => formatWeekday(weekday)),
        { type: "conjunction" },
      ),
    );

    return operation.minutes === 0
      ? t("{days}: rest day.", { days })
      : t("{days}: {time} a day.", { days, time: formatDuration(operation.minutes) });
  };
}

export function useWeeklyEventsText() {
  const t = useExtracted();
  const formatWeekday = useFormatWeekday();

  return function weeklyEventsText(effect: PlanChangeView["effect"]): string | null {
    const moved = effect?.weeklyEvents;

    if (!moved) {
      return null;
    }

    const day = formatWeekday(moved.after);

    return moved.kind === "mock"
      ? t({
          description: '{day} is a weekday, like "Monday".',
          message: "Weekly mocks move to {day}.",
          values: { day },
        })
      : t({
          description: '{day} is a weekday, like "Monday".',
          message: "Weekly challenges move to {day}.",
          values: { day },
        });
  };
}

export function useNextMockText() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function nextMockText(effect: PlanChangeView["effect"]): string | null {
    const moved = effect?.nextMock;

    return moved
      ? t({
          description: '{date} is a weekday and day, like "Monday, May 5".',
          message: "Your next mock moves to {date}.",
          values: { date: formatDate(moved.after, "weekdayDay") },
        })
      : null;
  };
}

"use client";

import { type ChallengeView } from "@zoonk/core/checkpoints/challenge-contract";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { useExtracted } from "next-intl";
import { isoDateToUtc, useFormatIsoDate } from "../_utils/iso-date";
import { useFormatTimeOfDay } from "../_utils/time-format";

const DAYS_IN_A_WEEK = 7;

/** Whole days from `from` to `to`, both YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
  return Math.round((isoDateToUtc(to).getTime() - isoDateToUtc(from).getTime()) / MS_PER_DAY);
}

/** "Today", "Tomorrow", "Sunday" within the week, or the date further away. */
function useChallengeDay(today: string) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return (isoDate: string): string => {
    const days = daysBetween(today, isoDate);

    if (days <= 0) {
      return t("Today");
    }

    if (days === 1) {
      return t("Tomorrow");
    }

    return days < DAYS_IN_A_WEEK ? formatDate(isoDate, "weekday") : formatDate(isoDate, "long");
  };
}

/** When a challenge is: its day, and its time when it has one (an exam's real start time). */
export function useChallengeWhen(
  challenge: Pick<ChallengeView, "date" | "startTime" | "today">,
): string | null {
  const t = useExtracted();
  const day = useChallengeDay(challenge.today);
  const clockTime = useFormatTimeOfDay();

  if (!challenge.date) {
    return null;
  }

  return challenge.startTime
    ? t("{day} · {time}", { day: day(challenge.date), time: clockTime(challenge.startTime) })
    : day(challenge.date);
}

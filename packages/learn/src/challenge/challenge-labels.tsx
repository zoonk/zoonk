"use client";

import { type ChallengeView } from "@zoonk/core/checkpoints/challenge-contract";
import { useExtracted } from "next-intl";
import { daysBetween, useFormatIsoDate } from "../_utils/iso-date";
import { useFormatTimeOfDay } from "../_utils/time-format";
import { useExamDayDate } from "../exam/exam-labels";

const DAYS_IN_A_WEEK = 7;

function useChallengeDay(today: string) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const formatDay = useExamDayDate();

  return (isoDate: string): string => {
    const days = daysBetween(today, isoDate);

    if (days <= 0) {
      return t("Today");
    }

    if (days === 1) {
      return t("Tomorrow");
    }

    return days < DAYS_IN_A_WEEK ? formatDate(isoDate, "weekday") : formatDay(isoDate);
  };
}

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

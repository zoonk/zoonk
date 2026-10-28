"use client";

import { type ExamDayChecklistKey } from "@zoonk/core/exams/final-stretch/rules";
import { type ExamDay } from "@zoonk/core/exams/view/contract";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatTimeOfDay } from "../_utils/time-format";
import { useFormatPlanDate } from "../plan/plan-date-text";

export function useExamChecklistLabel() {
  const t = useExtracted();

  return (key: ExamDayChecklistKey): string => {
    switch (key) {
      case "documents":
        return t("Photo ID and your registration card");
      case "blackPen":
        return t("A black pen with a clear barrel");
      case "route":
        return t("Your route there, with time to spare");
      case "examTime":
        return t("When the gates close and the exam starts");
      case "sleep":
        return t("A good night's sleep");
      case "materials":
        return t("What your teacher lets you bring, like a pen or a calculator");
      default:
        return key;
    }
  };
}

/** The year always shows: the learner may prepare for an edition years ahead. */
export function useExamDayText() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const formatTimeOfDay = useFormatTimeOfDay();

  return (day: ExamDay): string => {
    const date = `${formatDate(day.date, "weekday")}, ${formatDate(day.date, "longYear")}`;

    if (!day.startTime) {
      return date;
    }

    return t("{date} · {time}", { date, time: formatTimeOfDay(day.startTime) });
  };
}

export function useExamDayDate() {
  const formatDate = useFormatIsoDate();
  const formatPlanDate = useFormatPlanDate();

  return (isoDate: string): string =>
    `${formatDate(isoDate, "weekdayShort")}, ${formatPlanDate(isoDate)}`;
}

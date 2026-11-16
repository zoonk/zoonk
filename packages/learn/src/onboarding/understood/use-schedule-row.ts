"use client";

import { type UnderstoodSchedule } from "@zoonk/core/view-models/onboarding/contract";
import { FACT_SEPARATOR } from "@zoonk/utils/facts";
import { useExtracted } from "next-intl";
import { useFormatDuration, useFormatTimeOfDay } from "../../_utils/time-format";
import { type UnderstoodRow } from "./use-understood-rows";

export function useScheduleRow() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const formatTime = useFormatTimeOfDay();

  return function toScheduleRow(
    schedule: UnderstoodSchedule,
    minutesSaid: boolean,
  ): UnderstoodRow | null {
    const when =
      schedule.studyTimeNote ?? (schedule.studyTime ? formatTime(schedule.studyTime) : null);

    const parts = [
      when,
      minutesSaid ? t("{time} a day", { time: formatDuration(schedule.dailyMinutes) }) : null,
    ].filter(Boolean);

    return parts.length > 0
      ? {
          editDefault: schedule.studyTime ?? "",
          editable: { key: "studyTime", kind: "time" },
          id: "schedule",
          label: t("When you study"),
          value: parts.join(FACT_SEPARATOR),
        }
      : null;
  };
}

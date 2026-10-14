"use client";

import { type WeeklyStudyTime } from "@zoonk/core/progress/weekly-study-time-contract";
import { createContext, use } from "react";

const WeeklyStudyTimeContext = createContext<WeeklyStudyTime | null>(null);

export function WeeklyStudyTimeProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: WeeklyStudyTime;
}) {
  return <WeeklyStudyTimeContext value={value}>{children}</WeeklyStudyTimeContext>;
}

export function useWeeklyStudyTime(): WeeklyStudyTime {
  const time = use(WeeklyStudyTimeContext);

  if (!time) {
    throw new Error("Weekly study time must be provided by the Journey screen");
  }

  return time;
}

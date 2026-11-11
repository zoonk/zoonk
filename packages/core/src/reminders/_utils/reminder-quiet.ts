import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { daysBetween } from "../../plans/planner/plan-calendar";

const QUIET_AFTER_DAYS = 7;

/** Studying, or turning a channel on, restarts the 7 days. */
export function isReminderQuiet({
  enabledAt,
  lastStudyDate,
  now,
  timeZone,
}: {
  enabledAt: Date | null;
  lastStudyDate: Date | null;
  now: Date;
  timeZone: string;
}): boolean {
  const enabledOn = enabledAt ? getDateInTimeZone({ date: enabledAt, timeZone }) : null;
  const days = [lastStudyDate, enabledOn].filter((day) => day !== null);

  if (days.length === 0) {
    return false;
  }

  const since = new Date(Math.max(...days.map((day) => day.getTime())));
  return daysBetween(since, getDateInTimeZone({ date: now, timeZone })) > QUIET_AFTER_DAYS;
}

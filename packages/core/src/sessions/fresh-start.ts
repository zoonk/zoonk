import { type StudyFreshStart } from "@zoonk/db";
import { daysBetween } from "../plans/planner/plan-calendar";

/** Count days since the last study day: Monday to Thursday is three days, with two full days away. */
const WELCOME_BACK_AFTER_DAYS = 3;

const MONDAY = 1;

const LIGHT_SESSION_SHARE = 0.45;
const MIN_LIGHT_MINUTES = 10;
const MINUTE_STEP = 5;

function getLastDayHere({
  lastStudyDate,
  startDate,
  today,
}: {
  lastStudyDate: Date | null;
  startDate: Date | null;
  today: Date;
}): Date | null {
  const start = startDate && startDate <= today ? startDate : null;

  if (!lastStudyDate || !start) {
    return lastStudyDate ?? start;
  }

  return lastStudyDate > start ? lastStudyDate : start;
}

/** Prioritizes return, new phase, then Monday; an unstudied goal counts absence from its start date. */
export function getFreshStart({
  isFirstDay,
  isNewPhase,
  lastStudyDate,
  startDate,
  today,
}: {
  /** No earlier day of this goal: the learner only just set it up. */
  isFirstDay: boolean;
  isNewPhase: boolean;
  /** The learner-local date of the last day with any study, or null when they haven't studied. */
  lastStudyDate: Date | null;
  /** The plan's first day (the goal's set-up day without one), as a UTC-midnight label. */
  startDate: Date | null;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
}): StudyFreshStart | null {
  const lastDayHere = getLastDayHere({ lastStudyDate, startDate, today });
  const daysAway = lastDayHere ? daysBetween(lastDayHere, today) : 0;

  if (daysAway >= WELCOME_BACK_AFTER_DAYS) {
    return "welcomeBack";
  }

  if (isFirstDay) {
    return null;
  }

  if (isNewPhase) {
    return "newPhase";
  }

  return today.getUTCDay() === MONDAY ? "newWeek" : null;
}

/** Rounds to five minutes without exceeding the usual day, including days shorter than the minimum light session. */
export function getLightMinutes(dailyMinutes: number): number {
  const light = Math.round((dailyMinutes * LIGHT_SESSION_SHARE) / MINUTE_STEP) * MINUTE_STEP;
  return Math.min(dailyMinutes, Math.max(MIN_LIGHT_MINUTES, light));
}

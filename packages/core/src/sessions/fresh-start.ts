import { type StudyFreshStart } from "@zoonk/db";
import { daysBetween } from "../plans/planner/plan-calendar";

/**
 * Coming back after this many days since the last study day is a welcome back: studying on
 * Monday and returning on Thursday means two days away. Nothing is lost and nobody is scolded.
 */
const WELCOME_BACK_AFTER_DAYS = 3;

const MONDAY = 1;

/** A welcome-back session is a bit under half the usual time: 20 minutes for a 45-minute goal. */
const LIGHT_SESSION_SHARE = 0.45;
const MIN_LIGHT_MINUTES = 10;
const MINUTE_STEP = 5;

/**
 * The last day the learner was here for this goal: their last study day, or the goal's start when
 * that's later (set up days ago and not studied since). A start still ahead counts nothing.
 */
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

/**
 * Why today starts fresh, the most important reason first: a return after a break, the first day
 * of a new phase, or a Monday. Every fresh start opens with an easy warm-up and no backlog; a
 * return after a break is also shorter. A goal's first day starts nothing over: it's just day one.
 * Rafaela set up her goal, opened Today and left: six days later is a return, though she never
 * studied, so the days away count from the goal's start too.
 */
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

/** The minutes of a light session, rounded to five and never longer than the usual day. */
export function getLightMinutes(dailyMinutes: number): number {
  const light = Math.round((dailyMinutes * LIGHT_SESSION_SHARE) / MINUTE_STEP) * MINUTE_STEP;
  return Math.min(dailyMinutes, Math.max(MIN_LIGHT_MINUTES, light));
}

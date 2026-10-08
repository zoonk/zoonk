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
 * Why today starts fresh, the most important reason first: a return after a break, the first day
 * of a new phase, or a Monday. Every fresh start opens with an easy warm-up and no backlog; a
 * return after a break is also shorter. A goal's first day starts nothing over: it's just day one.
 */
export function getFreshStart({
  isFirstDay,
  isNewPhase,
  lastStudyDate,
  today,
}: {
  /** No earlier day of this goal: the learner only just set it up. */
  isFirstDay: boolean;
  isNewPhase: boolean;
  /** The learner-local date of the last day with any study, or null for a first day. */
  lastStudyDate: Date | null;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
}): StudyFreshStart | null {
  if (isFirstDay) {
    return null;
  }

  const daysSince = lastStudyDate ? daysBetween(lastStudyDate, today) : 0;

  if (daysSince >= WELCOME_BACK_AFTER_DAYS) {
    return "welcomeBack";
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

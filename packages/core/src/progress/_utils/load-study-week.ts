import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { readEntitlementViewer } from "../../entitlements/_utils/entitlement-viewer";
import { getExamPrepAccess } from "../../entitlements/limits";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readPlannedDay } from "../../learner/facts/planned-day";
import { getRequestInstant } from "../../learner/facts/request-instant";
import { getStartOfWeek } from "../../plans/planner/plan-calendar";
import { getGoalDayMinutes } from "../../sessions/_utils/day-minutes";
import { getFreeWeekEnd } from "../../sessions/_utils/exam-access";
import {
  type WeekDay,
  getNextStudyDate,
  getWeekDayKind,
  getWeekDays,
  toStudiedMinutes,
} from "../../sessions/daily-goal";
import { type WeeklyStudyTime } from "../weekly-study-time-contract";

export type StudyWeek = {
  days: WeekDay[];
  /** Next local study day within a week, even beyond this week's end; null without one. */
  nextStudyDate: Date | null;
  time: WeeklyStudyTime;
};

type WeekGoal = Pick<
  Goal,
  "createdAt" | "dailyMinutes" | "id" | "kind" | "targetDate" | "timezone" | "userId"
>;

const WEEK_DAYS = 7;

async function loadSavedSettings(goalId: string): Promise<unknown> {
  const plan = await prisma.plan.findUnique({ select: { settings: true }, where: { goalId } });
  return plan?.settings;
}

/** One goal's week: its plan's days, its sessions and the time recorded for it, never another goal's. */
export async function loadStudyWeek({
  goal,
  localDate,
  planSettings,
}: {
  goal: WeekGoal;
  localDate: Date;
  /** The plan the request shows, such as a choice not saved yet; the saved plan's otherwise. */
  planSettings?: unknown;
}): Promise<StudyWeek> {
  const weekStart = getStartOfWeek(localDate);

  const weekDates = { gte: weekStart, lt: new Date(weekStart.getTime() + WEEK_DAYS * MS_PER_DAY) };
  const where = { goalId: goal.id, localDate: weekDates, userId: goal.userId };

  const [days, sessions, settings, viewer, now] = await Promise.all([
    // Session rows repeat their blocks' seconds.
    prisma.learningEvent.groupBy({
      _sum: { seconds: true },
      by: ["localDate"],
      where: { ...where, kind: { not: "session" } },
    }),
    prisma.studySession.findMany({
      select: { endedAt: true, localDate: true, plannedMinutes: true },
      where,
    }),
    planSettings === undefined ? loadSavedSettings(goal.id) : Promise.resolve(planSettings),
    readEntitlementViewer(),
    getRequestInstant(),
  ]);

  const timeZone = getAnswerTimeZone({ goal });
  const examPrep = viewer ? getExamPrepAccess(viewer.tier) : null;
  const freeUntil = getFreeWeekEnd({ examPrep, goal, timeZone });

  // Dates before the goal existed must not appear as missed study or chosen rest days.
  const startDate = getDateInTimeZone({ date: goal.createdAt, timeZone });

  const getSavedMinutes = (date: Date): number | undefined =>
    sessions.find((day) => day.localDate.getTime() === date.getTime())?.plannedMinutes;

  /** Past days keep the budget their saved session requested, regardless of later setting changes. */
  const getPastMinutes = (date: Date): number | null => {
    const asked = getSavedMinutes(date);
    return date < localDate && asked ? asked : null;
  };

  const getPlanMinutes = (date: Date): number =>
    date < startDate
      ? 0
      : (getPastMinutes(date) ?? getGoalDayMinutes({ date, goal, planSettings: settings }));

  const isPastFreeWeek = (date: Date): boolean => freeUntil !== null && date > freeUntil;

  const isToday = getDateInTimeZone({ date: now, timeZone }).getTime() === localDate.getTime();

  // Before Start saves today's session, the day counts what Today plans for it.
  const planned =
    isToday && isPastFreeWeek(localDate) && getSavedMinutes(localDate) === undefined
      ? await readPlannedDay(goal.userId, goal.id, timeZone)
      : null;

  const plannedToday = planned?.day.plannedMinutes ?? 0;

  // Past the free exam week a day holds only reviews and mistakes, so the plan's time would be a
  // target the learner can't reach. A day whose session isn't planned yet holds no known time.
  const getDayMinutes = (date: Date): number => {
    if (!isPastFreeWeek(date)) {
      return getPlanMinutes(date);
    }

    return getSavedMinutes(date) ?? (date.getTime() === localDate.getTime() ? plannedToday : 0);
  };

  const weekGoal = { isExam: goal.kind === "exam", startDate, targetDate: goal.targetDate };

  // Adding more time can reopen a completed session; its original completion still counts.
  const finishedDates = sessions.flatMap((day) => (day.endedAt ? [day.localDate] : []));

  const studied = days.map((day) => ({ date: day.localDate, seconds: day._sum.seconds ?? 0 }));

  const week = getWeekDays({
    days: studied,
    finishedDates,
    getPlanDay: (date) => ({
      goalMinutes: getDayMinutes(date),
      kind: getWeekDayKind({ date, goal: weekGoal, goalMinutes: getPlanMinutes(date) }),
    }),
    today: localDate,
  });

  return {
    days: week,
    nextStudyDate: getNextStudyDate({ getMinutes: getPlanMinutes, today: localDate }),
    time: {
      studiedMinutes: toStudiedMinutes(studied.reduce((total, day) => total + day.seconds, 0)),
      targetMinutes: week.reduce((total, day) => total + day.goalMinutes, 0),
    },
  };
}

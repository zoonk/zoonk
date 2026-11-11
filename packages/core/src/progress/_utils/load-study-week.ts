import "server-only";
import { prisma } from "@zoonk/db";
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
  type PlanDay,
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

const WEEK_DAYS = 7;

/** Active goals share one daily budget; sum each plan's allocations including rest/light days. */
export async function loadStudyWeek({
  localDate,
  selectedPlan,
  userId,
}: {
  localDate: Date;
  selectedPlan?: { goalId: string; settings: unknown };
  userId: string;
}): Promise<StudyWeek> {
  const weekStart = getStartOfWeek(localDate);

  const weekDates = { gte: weekStart, lt: new Date(weekStart.getTime() + WEEK_DAYS * MS_PER_DAY) };

  const [days, sessions, goals, viewer, now] = await Promise.all([
    prisma.dailyProgress.findMany({
      select: { date: true, timeSpentSeconds: true },
      where: { date: weekDates, userId },
    }),
    prisma.studySession.findMany({
      select: { endedAt: true, goalId: true, localDate: true, plannedMinutes: true },
      where: { localDate: weekDates, userId },
    }),
    prisma.goal.findMany({
      include: { plan: { select: { settings: true } } },
      where: { status: "active", userId },
    }),
    readEntitlementViewer(),
    getRequestInstant(),
  ]);

  const examPrep = viewer ? getExamPrepAccess(viewer.tier) : null;

  // Adding more time can reopen a completed session; its original completion still counts.
  const completed = sessions.filter((day) => day.endedAt !== null);

  const getSavedMinutes = (goalId: string, date: Date): number | undefined =>
    sessions.find((day) => day.goalId === goalId && day.localDate.getTime() === date.getTime())
      ?.plannedMinutes;

  /** Past days keep the budget their saved session requested, regardless of later setting changes. */
  const getPastMinutes = (goalId: string, date: Date): number | null => {
    const asked = getSavedMinutes(goalId, date);
    return date < localDate && asked ? asked : null;
  };

  const started = goals.map((goal) => {
    const timeZone = getAnswerTimeZone({ goal });

    return {
      freeUntil: getFreeWeekEnd({ examPrep, goal, timeZone }),
      goal,
      isExam: goal.kind === "exam",
      planSettings: selectedPlan?.goalId === goal.id ? selectedPlan.settings : goal.plan?.settings,
      startDate: getDateInTimeZone({ date: goal.createdAt, timeZone }),
      targetDate: goal.targetDate,
      timeZone,
    };
  });

  type StartedGoal = (typeof started)[number];

  const isPastFreeWeek = ({ freeUntil }: StartedGoal, date: Date): boolean =>
    freeUntil !== null && date > freeUntil;

  // Before Start saves today's session, the day counts what Today plans for it.
  const unbuilt = started.filter(
    (entry) =>
      isPastFreeWeek(entry, localDate) &&
      getSavedMinutes(entry.goal.id, localDate) === undefined &&
      getDateInTimeZone({ date: now, timeZone: entry.timeZone }).getTime() === localDate.getTime(),
  );

  const plannedToday = new Map(
    await Promise.all(
      unbuilt.map(async ({ goal, timeZone }) => {
        const planned = await readPlannedDay(userId, goal.id, timeZone);
        return [goal.id, planned?.day.plannedMinutes ?? 0] as const;
      }),
    ),
  );

  // Dates before a goal existed must not appear as missed study or chosen rest days.
  const getPlanMinutes = ({ goal, planSettings, startDate }: StartedGoal, date: Date): number =>
    date < startDate
      ? 0
      : (getPastMinutes(goal.id, date) ?? getGoalDayMinutes({ date, goal, planSettings }));

  const getUnbuiltMinutes = (goalId: string, date: Date): number =>
    date.getTime() === localDate.getTime() ? (plannedToday.get(goalId) ?? 0) : 0;

  // Past the free exam week a day holds only reviews and mistakes, so the plan's time would be a
  // target the learner can't reach. A day whose session isn't planned yet holds no known time.
  const getGoalMinutes = (entry: StartedGoal, date: Date): number =>
    isPastFreeWeek(entry, date)
      ? (getSavedMinutes(entry.goal.id, date) ?? getUnbuiltMinutes(entry.goal.id, date))
      : getPlanMinutes(entry, date);

  const sumGoals = (date: Date, getMinutes: (entry: StartedGoal, date: Date) => number): number =>
    started.reduce((sum, entry) => sum + getMinutes(entry, date), 0);

  const hasFinished = (goalId: string, date: Date): boolean =>
    completed.some((day) => day.goalId === goalId && day.localDate.getTime() === date.getTime());

  const isDayFinished = (date: Date): boolean =>
    started
      .filter((entry) => getGoalMinutes(entry, date) > 0)
      .every(({ goal }) => hasFinished(goal.id, date));

  const getPlanDay = (date: Date): PlanDay => ({
    goalMinutes: sumGoals(date, getGoalMinutes),
    kind: getWeekDayKind({ date, goalMinutes: sumGoals(date, getPlanMinutes), goals: started }),
  });

  const studiedDates = completed.map((day) => day.localDate);

  const week = getWeekDays({
    days: days.map((day) => ({ date: day.date, seconds: day.timeSpentSeconds })),
    finishedDates: studiedDates.filter((date) => isDayFinished(date)),
    getPlanDay,
    studiedDates,
    today: localDate,
  });

  return {
    days: week,
    nextStudyDate: getNextStudyDate({
      getMinutes: (date) => sumGoals(date, getPlanMinutes),
      today: localDate,
    }),
    time: {
      studiedMinutes: toStudiedMinutes(
        days.reduce((total, day) => total + day.timeSpentSeconds, 0),
      ),
      targetMinutes: week.reduce((total, day) => total + day.goalMinutes, 0),
    },
  };
}

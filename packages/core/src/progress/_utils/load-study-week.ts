import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getStartOfWeek } from "../../plans/planner/plan-calendar";
import { getGoalDayMinutes } from "../../sessions/_utils/day-minutes";
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

  const [days, sessions, goals] = await Promise.all([
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
  ]);

  // Adding more time can reopen a completed session; its original completion still counts.
  const completed = sessions.filter((day) => day.endedAt !== null);

  /** Past days keep the budget their saved session requested, regardless of later setting changes. */
  const getPastMinutes = (goalId: string, date: Date): number | null => {
    const asked = sessions.find(
      (day) => day.goalId === goalId && day.localDate.getTime() === date.getTime(),
    )?.plannedMinutes;

    return date < localDate && asked ? asked : null;
  };

  const started = goals.map((goal) => ({
    goal,
    isExam: goal.kind === "exam",
    planSettings: selectedPlan?.goalId === goal.id ? selectedPlan.settings : goal.plan?.settings,
    startDate: getDateInTimeZone({ date: goal.createdAt, timeZone: getAnswerTimeZone({ goal }) }),
    targetDate: goal.targetDate,
  }));

  // Dates before a goal existed must not appear as missed study or chosen rest days.
  const getGoalMinutes = (
    { goal, planSettings, startDate }: (typeof started)[number],
    date: Date,
  ): number =>
    date < startDate
      ? 0
      : (getPastMinutes(goal.id, date) ?? getGoalDayMinutes({ date, goal, planSettings }));

  const getDayMinutes = (date: Date): number =>
    started.reduce((sum, entry) => sum + getGoalMinutes(entry, date), 0);

  const hasFinished = (goalId: string, date: Date): boolean =>
    completed.some((day) => day.goalId === goalId && day.localDate.getTime() === date.getTime());

  const isDayFinished = (date: Date): boolean =>
    started
      .filter((entry) => getGoalMinutes(entry, date) > 0)
      .every(({ goal }) => hasFinished(goal.id, date));

  const getPlanDay = (date: Date): PlanDay => {
    const goalMinutes = getDayMinutes(date);
    return { goalMinutes, kind: getWeekDayKind({ date, goalMinutes, goals: started }) };
  };

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
    nextStudyDate: getNextStudyDate({ getMinutes: getDayMinutes, today: localDate }),
    time: {
      studiedMinutes: toStudiedMinutes(
        days.reduce((total, day) => total + day.timeSpentSeconds, 0),
      ),
      targetMinutes: week.reduce((total, day) => total + day.goalMinutes, 0),
    },
  };
}

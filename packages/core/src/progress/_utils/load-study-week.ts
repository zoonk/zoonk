import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getStartOfWeek } from "../../plans/planner/plan-calendar";
import { getGoalDayMinutes } from "../../sessions/_utils/day-minutes";
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
  totals: { questions: number; seconds: number };
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

async function loadWeekFacts({
  goal,
  from,
  until,
  planSettings,
}: {
  goal: WeekGoal;
  from: Date;
  until: Date;
  planSettings?: unknown;
}) {
  const where = { goalId: goal.id, localDate: { gte: from, lt: until }, userId: goal.userId };

  const [days, sessions, settings] = await Promise.all([
    // Session rows repeat their blocks' seconds and answers.
    prisma.learningEvent.groupBy({
      _sum: { correctAnswers: true, incorrectAnswers: true, seconds: true },
      by: ["localDate"],
      where: { ...where, kind: { not: "session" } },
    }),
    prisma.studySession.findMany({
      select: { endedAt: true, localDate: true, plannedMinutes: true },
      where,
    }),
    planSettings === undefined ? loadSavedSettings(goal.id) : Promise.resolve(planSettings),
  ]);

  return { days, sessions, settings };
}

function buildStudyWeek({
  goal,
  localDate,
  weekStart,
  facts,
}: {
  goal: WeekGoal;
  localDate: Date;
  weekStart: Date;
  facts: Awaited<ReturnType<typeof loadWeekFacts>>;
}): StudyWeek {
  const until = new Date(weekStart.getTime() + WEEK_DAYS * MS_PER_DAY);
  const days = facts.days.filter((day) => day.localDate >= weekStart && day.localDate < until);
  const { sessions, settings } = facts;
  const timeZone = getAnswerTimeZone({ goal });

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

  const weekGoal = { isExam: goal.kind === "exam", startDate, targetDate: goal.targetDate };

  // Adding more time can reopen a completed session; its original completion still counts.
  const finishedDates = sessions.flatMap((day) => (day.endedAt ? [day.localDate] : []));

  const studied = days.map((day) => ({ date: day.localDate, seconds: day._sum.seconds ?? 0 }));

  const week = getWeekDays({
    days: studied,
    finishedDates,
    getPlanDay: (date) => ({
      goalMinutes: getPlanMinutes(date),
      kind: getWeekDayKind({ date, goal: weekGoal, goalMinutes: getPlanMinutes(date) }),
    }),
    today: localDate,
    weekStart,
  });

  const seconds = studied.reduce((total, day) => total + day.seconds, 0);

  return {
    days: week,
    nextStudyDate: getNextStudyDate({ getMinutes: getPlanMinutes, today: localDate }),
    time: {
      studiedMinutes: toStudiedMinutes(seconds),
      targetMinutes: week.reduce((total, day) => total + day.goalMinutes, 0),
    },
    totals: {
      questions: days.reduce(
        (total, day) => total + (day._sum.correctAnswers ?? 0) + (day._sum.incorrectAnswers ?? 0),
        0,
      ),
      seconds,
    },
  };
}

/** One goal's week: its plan's days, its sessions and its recorded study. */
export async function loadStudyWeek({
  goal,
  localDate,
  planSettings,
  weekStart = getStartOfWeek(localDate),
}: {
  goal: WeekGoal;
  localDate: Date;
  planSettings?: unknown;
  weekStart?: Date;
}): Promise<StudyWeek> {
  const facts = await loadWeekFacts({
    from: weekStart,
    goal,
    planSettings,
    until: new Date(weekStart.getTime() + WEEK_DAYS * MS_PER_DAY),
  });

  return buildStudyWeek({ facts, goal, localDate, weekStart });
}

export async function loadStudyWeekPair({
  goal,
  localDate,
  weekStart,
}: {
  goal: WeekGoal;
  localDate: Date;
  weekStart: Date;
}): Promise<{ week: StudyWeek; lastWeek: StudyWeek }> {
  const lastWeekStart = new Date(weekStart.getTime() - WEEK_DAYS * MS_PER_DAY);

  const facts = await loadWeekFacts({
    from: lastWeekStart,
    goal,
    until: new Date(weekStart.getTime() + WEEK_DAYS * MS_PER_DAY),
  });

  return {
    lastWeek: buildStudyWeek({ facts, goal, localDate, weekStart: lastWeekStart }),
    week: buildStudyWeek({ facts, goal, localDate, weekStart }),
  };
}

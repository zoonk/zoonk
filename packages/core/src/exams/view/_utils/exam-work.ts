import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { addDays, daysBetween, fromIsoDate, toIsoDate } from "../../../plans/planner/plan-calendar";
import { parsePlanSettings } from "../../../plans/planner/plan-state";
import { loadCatchUpItems } from "../../../sessions/_utils/catch-up";
import { getGoalDayMinutes } from "../../../sessions/_utils/day-minutes";

const PREPARED_DAYS_SHARE = 0.8;

type WorkGoal = NonNullable<Awaited<ReturnType<typeof loadWorkGoal>>>;

function loadWorkGoal(goalId: string) {
  return prisma.goal.findUnique({
    select: {
      createdAt: true,
      dailyMinutes: true,
      kind: true,
      plan: { select: { settings: true } },
      targetDate: true,
      timezone: true,
    },
    where: { id: goalId },
  });
}

function listPlannedDaysBefore({ goal, today }: { goal: WorkGoal; today: Date }): string[] {
  const settings = parsePlanSettings(goal.plan?.settings);
  const timeZone = goal.timezone && isValidTimeZone(goal.timezone) ? goal.timezone : "UTC";

  const start = settings.startDate
    ? fromIsoDate(settings.startDate)
    : getDateInTimeZone({ date: goal.createdAt, timeZone });

  return Array.from({ length: Math.max(0, daysBetween(start, today)) }, (_, offset) =>
    addDays(start, offset),
  )
    .filter((date) => getGoalDayMinutes({ date, goal, planSettings: goal.plan?.settings }) > 0)
    .map((date) => toIsoDate(date));
}

export async function loadExamWork({
  goalId,
  today,
}: {
  goalId: string;
  today: Date;
}): Promise<{ prepared: boolean; sessionsDone: number }> {
  const [goal, sessions, catchUp] = await Promise.all([
    loadWorkGoal(goalId),
    prisma.studySession.findMany({
      select: { localDate: true, status: true },
      where: { goalId, startedAt: { not: null } },
    }),
    loadCatchUpItems(goalId),
  ]);

  const studyDays = goal ? listPlannedDaysBefore({ goal, today }) : [];

  const finished = new Set(
    sessions
      .filter((session) => session.status === "completed")
      .map((session) => toIsoDate(session.localDate)),
  );

  const finishedDays = studyDays.filter((day) => finished.has(day)).length;

  return {
    prepared:
      sessions.length > 0 &&
      catchUp.length === 0 &&
      finishedDays >= studyDays.length * PREPARED_DAYS_SHARE,
    sessionsDone: sessions.length,
  };
}

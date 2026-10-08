import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { addDays, daysBetween, fromIsoDate, toIsoDate } from "../../../plans/planner/plan-calendar";
import { parsePlanSettings } from "../../../plans/planner/plan-state";
import { loadCatchUpItems } from "../../../sessions/_utils/catch-up";
import { getGoalDayMinutes } from "../../../sessions/_utils/day-minutes";

/**
 * The share of the plan's study days so far whose session the learner finished for the day to say
 * they prepared: most of them, so a day missed in months of study doesn't take it away, while a
 * class test's one day left halfway does.
 */
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

/** The plan's study days before today: from its first day, the ones that plan some time. */
function listStudyDays({ goal, today }: { goal: WorkGoal; today: Date }): string[] {
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

/**
 * The work behind the exam's day: the sessions the learner did, and whether they did what their
 * plan asked before today, which is when the day before and the day itself say they prepared: at
 * least one session, no lessons left from earlier days, and most of the plan's study days so far
 * finished (every block done), never a day started and left halfway.
 */
export async function loadExamWork({
  goalId,
  today,
}: {
  goalId: string;
  /** The learner-local date, as a UTC-midnight label. */
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

  const studyDays = goal ? listStudyDays({ goal, today }) : [];

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

import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { findActiveGoalId } from "../../goals/_utils/goal-view";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { loadDailyTimeLimitStatus } from "../../sessions/_utils/daily-time-limit";
import { getGoalDayMinutes } from "../../sessions/_utils/day-minutes";
import { getSessionMinutesDone } from "../../sessions/daily-goal";

export type GoalWithWork = {
  goalId: string;
  isExam: boolean;
  minutesDone: number;
  minutesLeft: number;
  title: string;
};

const RECENT_STUDY_MS = 1_800_000;

async function loadLimitReachedDates({ dates, userId }: { dates: Date[]; userId: string }) {
  const unique = [...new Map(dates.map((date) => [toIsoDate(date), date])).values()];

  const statuses = await Promise.all(
    unique.map(async (date) => {
      const status = await loadDailyTimeLimitStatus({ date, userId });
      return { day: toIsoDate(date), reached: status.reached };
    }),
  );

  return new Set(statuses.filter((status) => status.reached).map((status) => status.day));
}

/**
 * Today's goals that still have work, the active goal first. Reads each goal's day in its own zone,
 * as Today does, and never creates a session.
 */
export async function findGoalsWithWork({
  now,
  userId,
}: {
  now: Date;
  userId: string;
}): Promise<GoalWithWork[]> {
  const [goals, activeGoalId] = await Promise.all([
    prisma.goal.findMany({
      include: { plan: { select: { settings: true } } },
      orderBy: { createdAt: "asc" },
      where: { plan: { isNot: null }, status: "active", userId },
    }),
    findActiveGoalId(userId),
  ]);

  const days = goals.map((goal) => ({
    goal,
    localDate: getDateInTimeZone({ date: now, timeZone: getAnswerTimeZone({ goal }) }),
  }));

  if (days.length === 0) {
    return [];
  }

  const [sessions, limitReached] = await Promise.all([
    prisma.studySession.findMany({
      include: { blocks: { select: { estimatedMinutes: true, status: true } } },
      where: { OR: days.map((day) => ({ goalId: day.goal.id, localDate: day.localDate })), userId },
    }),
    loadLimitReachedDates({ dates: days.map((day) => day.localDate), userId }),
  ]);

  const open = days.flatMap(({ goal, localDate }) => {
    const dayMinutes = getGoalDayMinutes({
      date: localDate,
      goal,
      planSettings: goal.plan?.settings,
    });

    const session = sessions.find((candidate) => candidate.goalId === goal.id);
    const minutesDone = Math.round(getSessionMinutesDone(session?.blocks ?? []));
    const ended = session?.status === "completed" || Boolean(session?.stoppedAt);

    if (
      dayMinutes <= 0 ||
      ended ||
      minutesDone >= dayMinutes ||
      limitReached.has(toIsoDate(localDate))
    ) {
      return [];
    }

    return [
      {
        goalId: goal.id,
        isExam: goal.kind === "exam",
        minutesDone,
        minutesLeft: dayMinutes - minutesDone,
        title: goal.title,
      },
    ];
  });

  return open.toSorted(
    (first, second) =>
      Number(second.goalId === activeGoalId) - Number(first.goalId === activeGoalId),
  );
}

/** A reminder waits while the learner is studying; the next sweep looks again. */
export async function hasStudiedRecently({
  now,
  userId,
}: {
  now: Date;
  userId: string;
}): Promise<boolean> {
  const since = new Date(now.getTime() - RECENT_STUDY_MS);

  const [answer, block] = await Promise.all([
    prisma.attempt.findFirst({
      select: { id: true },
      where: { answeredAt: { gte: since }, userId },
    }),
    prisma.studySessionBlock.findFirst({
      select: { id: true },
      where: {
        OR: [{ startedAt: { gte: since } }, { completedAt: { gte: since } }],
        session: { userId },
      },
    }),
  ]);

  return Boolean(answer || block);
}

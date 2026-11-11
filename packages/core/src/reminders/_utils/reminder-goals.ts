import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { findActiveGoalId } from "../../goals/_utils/goal-view";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getGoalDayMinutes } from "../../sessions/_utils/day-minutes";
import { getPlanStart } from "../../sessions/_utils/day-plan";
import { getSessionMinutes } from "../../sessions/session-minutes";

export type GoalWithWork = {
  goalId: string;
  isExam: boolean;
  minutesDone: number;
  minutesLeft: number;
  title: string;
};

const RECENT_STUDY_MS = 1_800_000;

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

  const days = goals.map((goal) => {
    const timeZone = getAnswerTimeZone({ goal });

    return {
      goal,
      localDate: getDateInTimeZone({ date: now, timeZone }),
      planStart: getPlanStart({ goal, settings: goal.plan?.settings, timeZone }),
    };
  });

  if (days.length === 0) {
    return [];
  }

  const sessions = await prisma.studySession.findMany({
    include: { blocks: { select: { estimatedMinutes: true, payload: true, status: true } } },
    where: { OR: days.map((day) => ({ goalId: day.goal.id, localDate: day.localDate })), userId },
  });

  const open = days.flatMap(({ goal, localDate, planStart }) => {
    const dayMinutes = getGoalDayMinutes({
      date: localDate,
      goal,
      planSettings: goal.plan?.settings,
    });

    const session = sessions.find((candidate) => candidate.goalId === goal.id);
    const ended = session?.status === "completed" || Boolean(session?.stoppedAt);

    // Today's own count of the day's time, so a reminder never says less or more is left.
    const minutes = session
      ? getSessionMinutes({
          blocks: session.blocks,
          dailyGoal: dayMinutes,
          planned: session.plannedMinutes,
        })
      : { done: 0, left: dayMinutes };

    if (localDate < planStart || dayMinutes <= 0 || ended || minutes.left <= 0) {
      return [];
    }

    return [
      {
        goalId: goal.id,
        isExam: goal.kind === "exam",
        minutesDone: minutes.done,
        minutesLeft: Math.round(minutes.left),
        title: goal.displayName,
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

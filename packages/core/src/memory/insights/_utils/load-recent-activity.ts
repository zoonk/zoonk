import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { loadGoalSkillIds } from "../../../learner/_utils/goal-skill-graph";
import { readMistakeSnapshot } from "../../../mistakes/mistake-snapshot";
import { type RecentActivity } from "./activity-signals";

const WINDOW_DAYS = 7;

/**
 * A session row already sums its own blocks, so a day counts its sessions or its activities,
 * whichever is larger.
 */
function toStudyDays(
  events: readonly { kind: string; localDate: Date; seconds: number }[],
): RecentActivity["studyDays"] {
  const byDay = Map.groupBy(events, (event) => event.localDate.getTime());

  return [...byDay.entries()].map(([time, dayEvents]) => {
    const sumSeconds = (isSession: boolean) =>
      dayEvents
        .filter((event) => (event.kind === "session") === isSession)
        .reduce((total, event) => total + event.seconds, 0);

    return { localDate: new Date(time), seconds: Math.max(sumSeconds(true), sumSeconds(false)) };
  });
}

export async function loadRecentActivity({
  goal,
  now,
  timeZone,
}: {
  goal: Pick<Goal, "dailyMinutes" | "id" | "userId">;
  now: Date;
  timeZone: string;
}): Promise<RecentActivity> {
  const userId = goal.userId;
  const today = getDateInTimeZone({ date: now, timeZone });
  const since = new Date(today.getTime() - (WINDOW_DAYS - 1) * MS_PER_DAY);

  const [attempts, mistakes, events, goalSkillIds] = await Promise.all([
    prisma.attempt.findMany({
      select: {
        answeredAt: true,
        hour: true,
        isCorrect: true,
        localDate: true,
        skillId: true,
        studySessionId: true,
      },
      where: { localDate: { gte: since }, userId },
    }),
    prisma.mistake.findMany({
      orderBy: { createdAt: "desc" },
      select: { cause: true, skillId: true, snapshot: true },
      where: { createdAt: { gte: new Date(now.getTime() - WINDOW_DAYS * MS_PER_DAY) }, userId },
    }),
    prisma.learningEvent.findMany({
      select: { kind: true, localDate: true, seconds: true },
      where: { endedAt: { not: null }, localDate: { gte: since }, userId },
    }),
    loadGoalSkillIds(goal.id),
  ]);

  const skills = await prisma.skill.findMany({
    select: { id: true, name: true },
    where: { id: { in: goalSkillIds } },
  });

  return {
    attempts,
    dailyMinutes: goal.dailyMinutes,
    mistakes: mistakes.map((mistake) => ({
      ...mistake,
      snapshot: readMistakeSnapshot(mistake.snapshot),
    })),
    skills,
    studyDays: toStudyDays(events),
    windowDays: WINDOW_DAYS,
  };
}

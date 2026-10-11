import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { findActiveGoalId } from "../../goals/_utils/goal-view";
import { getAnswerTimeZone } from "./owned-goal";

/** Whether the learner did anything on a day: answered a question, or opened a block of the goal's session. */
async function hasStudiedOn({
  day,
  goalId,
  userId,
}: {
  day: Date;
  goalId: string;
  userId: string;
}): Promise<boolean> {
  const [answer, block] = await Promise.all([
    prisma.attempt.findFirst({ select: { id: true }, where: { localDate: day, userId } }),
    prisma.studySessionBlock.findFirst({
      select: { id: true },
      where: { session: { goalId, localDate: day, userId }, startedAt: { not: null } },
    }),
  ]);

  return Boolean(answer ?? block);
}

/**
 * Follows a learner to the zone a request comes from. The goal's stored zone is the one source of
 * their day: a goal without one takes the request's, and another zone moves it only while nothing
 * was done yet in the goal's current day (no answer, no block opened), so the day changes before
 * it starts. A learner who already studied keeps their day until the next one. True when the
 * goal's zone changed.
 */
export async function moveGoalTimeZone({
  goal,
  now,
  timeZone,
}: {
  goal: Pick<Goal, "id" | "timezone" | "userId">;
  now: Date;
  timeZone: string | null | undefined;
}): Promise<boolean> {
  if (!timeZone || !isValidTimeZone(timeZone) || timeZone === goal.timezone) {
    return false;
  }

  const stored = goal.timezone && isValidTimeZone(goal.timezone) ? goal.timezone : null;

  if (stored) {
    const day = getDateInTimeZone({ date: now, timeZone: getAnswerTimeZone({ goal }) });

    if (await hasStudiedOn({ day, goalId: goal.id, userId: goal.userId })) {
      return false;
    }
  }

  await prisma.goal.update({ data: { timezone: timeZone }, where: { id: goal.id } });
  return true;
}

/**
 * The zone of the learner's day where no goal is at hand (a lesson, a mistakes drill, a
 * pronunciation round, progress): their active goal's stored zone, then the request's, then UTC,
 * so those screens read the same day as Today.
 */
export async function getLearnerTimeZone({
  timeZone,
  userId,
}: {
  timeZone?: string | null;
  userId: string;
}): Promise<string> {
  const goalId = await findActiveGoalId(userId);

  const goal = goalId
    ? await prisma.goal.findUnique({ select: { timezone: true }, where: { id: goalId } })
    : null;

  return getAnswerTimeZone({ goal, timeZone });
}

import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { findActiveGoalId } from "../../goals/_utils/goal-view";
import { getAnswerTimeZone } from "./owned-goal";

type StudyReader = Pick<TransactionClient, "attempt" | "studySessionBlock">;

async function hasStudiedOn({
  client = prisma,
  day,
  goalId,
  userId,
}: {
  client?: StudyReader;
  day: Date;
  goalId: string;
  userId: string;
}): Promise<boolean> {
  const [answer, block] = await Promise.all([
    client.attempt.findFirst({ select: { id: true }, where: { localDate: day, userId } }),
    client.studySessionBlock.findFirst({
      select: { id: true },
      where: { session: { goalId, localDate: day, userId }, startedAt: { not: null } },
    }),
  ]);

  return Boolean(answer ?? block);
}

/** Caller must hold the learner's lock and guard its update against the zone read here. */
export async function canMoveGoalTimeZone({
  client,
  goal,
  now,
  timeZone,
}: {
  client?: StudyReader;
  goal: Pick<Goal, "id" | "timezone" | "userId">;
  now: Date;
  timeZone: string | null | undefined;
}): Promise<boolean> {
  if (!timeZone || !isValidTimeZone(timeZone) || timeZone === goal.timezone) {
    return false;
  }

  if (!goal.timezone || !isValidTimeZone(goal.timezone)) {
    return true;
  }

  const day = getDateInTimeZone({ date: now, timeZone: getAnswerTimeZone({ goal }) });
  return !(await hasStudiedOn({ client, day, goalId: goal.id, userId: goal.userId }));
}

/** Uses the active goal's stored zone, then the request's zone, then UTC. */
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

import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { findActiveGoalId } from "../../goals/_utils/goal-view";
import { getAnswerTimeZone } from "./owned-goal";

/** What reads a learner's study: the client, or a writer's transaction. */
type StudyReader = Pick<TransactionClient, "attempt" | "studySessionBlock">;

/** Whether the learner did anything on a day: answered a question, or opened a block of the goal's session. */
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

/**
 * Whether the goal may follow `timeZone`, read without writing, for a caller
 * that writes the move in its own transaction (the learner's revision first) and guards its update
 * on the zone it read here. Read through that transaction (`client`) once it holds the learner's
 * lock, it also sees an answer or a block start committed while it waited.
 */
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

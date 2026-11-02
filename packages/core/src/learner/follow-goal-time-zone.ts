import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../cache/tags";
import { refreshGoalPlan } from "../plans/refresh-goal-plan";
import { canMoveGoalTimeZone } from "./_utils/goal-time-zone";
import { markLearnerChanged } from "./_utils/mark-learner-changed";
import { findOwnedGoal, getAnswerTimeZone } from "./_utils/owned-goal";

const MAX_FOLLOW_ATTEMPTS = 2;

export type FollowGoalTimeZoneResult =
  | { moved: boolean; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

type GoalTimeZoneMove = { kind: "moved"; planInputsChanged: boolean } | { kind: "unchanged" };

type TimeZoneUnchangedReason = "dayChanged" | "studied" | "zoneChanged";

/** Roll back early marks when a locked recheck refuses the move; infrastructure failures must propagate separately. */
class TimeZoneUnchangedError extends Error {
  override name = "TimeZoneUnchangedError";

  readonly reason: TimeZoneUnchangedReason;

  constructor(reason: TimeZoneUnchangedReason) {
    super(`The goal's zone didn't move: ${reason}`);
    this.reason = reason;
  }
}

export function isTimeZoneUnchanged(error: unknown): error is TimeZoneUnchangedError {
  return error instanceof TimeZoneUnchangedError;
}

function movesTheDate({
  goal,
  now,
  toZone,
}: {
  goal: { timezone: string | null };
  now: Date;
  toZone: string;
}): boolean {
  const today = getDateInTimeZone({ date: now, timeZone: getAnswerTimeZone({ goal }) });
  return getDateInTimeZone({ date: now, timeZone: toZone }).getTime() !== today.getTime();
}

async function readGoalZone(
  tx: TransactionClient,
  { goalId, userId }: { goalId: string; userId: string },
): Promise<string | null | undefined> {
  const goal = await tx.goal.findFirst({
    select: { timezone: true },
    where: { id: goalId, userId },
  });

  return goal?.timezone;
}

/** A locked recheck may throw TimeZoneUnchangedError to roll back early marks; other errors propagate. Caller expires caches after commit. */
export async function moveGoalTimeZoneInTransaction(
  tx: TransactionClient,
  {
    fromZone,
    goalId,
    toZone,
    userId,
  }: { fromZone: string | null; goalId: string; toZone: string; userId: string },
): Promise<GoalTimeZoneMove> {
  const goal = { id: goalId, timezone: fromZone, userId };
  const readAt = new Date();

  // Read through the caller's transaction: it already holds a connection, and the pool may have no other.
  if (!(await canMoveGoalTimeZone({ client: tx, goal, now: readAt, timeZone: toZone }))) {
    return { kind: "unchanged" };
  }

  const dateChanges = movesTheDate({ goal, now: readAt, toZone });

  await markLearnerChanged(tx, { planInputs: true, userId });

  const lockedAt = new Date();

  if ((await readGoalZone(tx, { goalId, userId })) !== fromZone) {
    throw new TimeZoneUnchangedError("zoneChanged");
  }

  if (movesTheDate({ goal, now: lockedAt, toZone }) !== dateChanges) {
    throw new TimeZoneUnchangedError("dayChanged");
  }

  if (!(await canMoveGoalTimeZone({ client: tx, goal, now: lockedAt, timeZone: toZone }))) {
    throw new TimeZoneUnchangedError("studied");
  }

  const { count } = await tx.goal.updateMany({
    data: { timezone: toZone },
    where: { id: goalId, timezone: fromZone, userId },
  });

  if (count === 0) {
    throw new TimeZoneUnchangedError("zoneChanged");
  }

  return { kind: "moved", planInputsChanged: true };
}

/** Reload the screen when moved is true; a lost race is retried once from fresh goal state. */
export async function followGoalTimeZone({
  attempt = 1,
  goalId,
  timeZone,
}: {
  attempt?: number;
  goalId: string;
  timeZone: string;
}): Promise<FollowGoalTimeZoneResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;

  if (timeZone === goal.timezone) {
    return { moved: false, status: "ready" };
  }

  const { data: move, error } = await safeAsync(() =>
    prisma.$transaction((tx) =>
      moveGoalTimeZoneInTransaction(tx, {
        fromZone: goal.timezone,
        goalId: goal.id,
        toZone: timeZone,
        userId,
      }),
    ),
  );

  if (error) {
    if (!isTimeZoneUnchanged(error)) {
      throw error;
    }

    if (error.reason !== "studied" && attempt < MAX_FOLLOW_ATTEMPTS) {
      return followGoalTimeZone({ attempt: attempt + 1, goalId: goal.id, timeZone });
    }

    return { moved: false, status: "ready" };
  }

  if (move.kind !== "moved") {
    return { moved: false, status: "ready" };
  }

  await refreshGoalPlan({ goalId });

  revalidateCacheTags([getGoalsCacheTag(userId), getLearnerModelCacheTag(userId)]);
  return { moved: true, status: "ready" };
}

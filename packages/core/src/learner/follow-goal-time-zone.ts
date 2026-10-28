import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { canMoveGoalTimeZone } from "./_utils/goal-time-zone";
import { markLearnerChanged } from "./_utils/mark-learner-changed";
import { getAnswerTimeZone } from "./_utils/owned-goal";

/**
 * A goal's zone move once written, or `unchanged` when the goal can't move (the learner studied
 * today, the zone isn't one, or it's already the goal's), before anything is written.
 */
type GoalTimeZoneMove = { kind: "moved"; planInputsChanged: boolean } | { kind: "unchanged" };

/**
 * Why a move found nothing to do once it held the learner's lock: the learner studied while it
 * waited (`studied`, the day stays theirs until the next one), another writer moved the zone
 * first (`zoneChanged`), or a midnight passed that changes whether the plan's days move
 * (`dayChanged`). The last two are worth trying again from a fresh read of the goal.
 */
type TimeZoneUnchangedReason = "dayChanged" | "studied" | "zoneChanged";

/**
 * The move can't happen after all, found once it held the learner's lock: thrown so the caller's
 * transaction rolls back the plan inputs it already marked. A caller tells it from a real failure with
 * `isTimeZoneUnchanged` and reads its `reason`; anything else thrown is an infrastructure failure,
 * never retried as this.
 */
class TimeZoneUnchangedError extends Error {
  override name = "TimeZoneUnchangedError";

  readonly reason: TimeZoneUnchangedReason;

  constructor(reason: TimeZoneUnchangedReason) {
    super(`The goal's zone didn't move: ${reason}`);
    this.reason = reason;
  }
}

/**
 * Whether a move's transaction rolled back because the move found nothing to do after all.
 */
export function isTimeZoneUnchanged(error: unknown): error is TimeZoneUnchangedError {
  return error instanceof TimeZoneUnchangedError;
}

/** Whether the goal's today is another date in `toZone` at `now`: the plan's days move then. */
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

/** The goal's stored zone as the writer's transaction reads it now; undefined once it's gone. */
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

/**
 * Moves a goal from `fromZone` (the zone the caller read) to `toZone` inside the caller's
 * transaction, when `canMoveGoalTimeZone` allows it: the plans' inputs and the learner's lock
 * first (a zone is an input even while its local date stays the same), then the same checks at the
 * moment it holds the learner's lock (the goal may have moved, an answer or a block start may have
 * committed, or a midnight passed, while it waited), then the zone, set only while it's still
 * `fromZone`. `unchanged` when the goal can't move, having written nothing; when that's only found
 * under the lock, it throws `TimeZoneUnchangedError` instead, so the caller's transaction rolls
 * back (with its early marks). It expires no cache: the caller does, once committed.
 */
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

  // Another writer moved the goal while this waited: its day is no longer the one checked.
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

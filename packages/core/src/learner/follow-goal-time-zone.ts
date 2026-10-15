import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { safeAsync } from "@zoonk/utils/error";
import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../cache/tags";
import { canMoveGoalTimeZone } from "./_utils/goal-time-zone";
import { getStartOfLocalDay } from "./_utils/local-time";
import { markLearnerChanged } from "./_utils/mark-learner-changed";
import { findOwnedGoal, getAnswerTimeZone } from "./_utils/owned-goal";

/** A follow that lost a race tries once more from a fresh read; a second loss says no move. */
const MAX_FOLLOW_ATTEMPTS = 2;

export type FollowGoalTimeZoneResult =
  | { learnerRevision: string; moved: true; status: "ready" }
  | { moved: false; retryAt: number; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/**
 * A goal's zone move once written, or why nothing was: `unchanged` when the goal can't move (the
 * learner studied today, the zone isn't one, or it's already the goal's), before anything is, and
 * when it may be worth asking again (`retryAt`, server time: the start of the day after the one the
 * learner studied on, else the moment it checked).
 *
 * @internal
 */
export type GoalTimeZoneMove =
  | { kind: "moved"; learnerRevision: bigint; planInputsChanged: boolean }
  | { kind: "unchanged"; retryAt: number };

/**
 * Why a move found nothing to do once it held the learner's lock: the learner studied while it
 * waited (`studied`, the day stays theirs until the next one), another writer moved the zone
 * first (`zoneChanged`), or a midnight passed that changes whether the plan's days move
 * (`dayChanged`). The last two are worth trying again from a fresh read of the goal.
 *
 * @internal
 */
export type TimeZoneUnchangedReason = "dayChanged" | "studied" | "zoneChanged";

/**
 * The move can't happen after all, found once it held the learner's lock: thrown so the caller's
 * transaction rolls back the revision it already raised. A caller tells it from a real failure with
 * `isTimeZoneUnchanged` and reads its `reason`; anything else thrown is an infrastructure failure,
 * never retried as this.
 *
 * @internal
 */
export class TimeZoneUnchangedError extends Error {
  override name = "TimeZoneUnchangedError";

  readonly reason: TimeZoneUnchangedReason;

  /** When it may be worth asking again (server time), as `GoalTimeZoneMove`'s `unchanged` says. */
  readonly retryAt: number;

  constructor(reason: TimeZoneUnchangedReason, retryAt: number) {
    super(`The goal's zone didn't move: ${reason}`);
    this.reason = reason;
    this.retryAt = retryAt;
  }
}

/**
 * Whether a move's transaction rolled back because the move found nothing to do after all.
 *
 * @internal
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

/** When a goal whose day was studied may move: the start of the day after the one at `checkedAt`. */
function getNextDayStart(goal: { timezone: string | null }, checkedAt: Date): number {
  const timeZone = getAnswerTimeZone({ goal });
  const today = getDateInTimeZone({ date: checkedAt, timeZone });

  return getStartOfLocalDay({
    localDate: new Date(today.getTime() + MS_PER_DAY),
    timeZone,
  }).getTime();
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
 * transaction, when `canMoveGoalTimeZone` allows it: the learner's revision first (with the plan's
 * inputs only when the goal's today becomes another date), then the same checks again at the
 * moment it holds the learner's lock (the goal may have moved, an answer or a block start may have
 * committed, or a midnight passed, while it waited), then the zone, set only while it's still
 * `fromZone`. `unchanged` when the goal can't move, having written nothing; when the goal moved
 * since the caller read it, or that's only found under the lock, it throws `TimeZoneUnchangedError`
 * instead, so the caller's transaction rolls back (with its early revision). It expires no cache:
 * the caller does, once committed.
 *
 * @internal Core's writers that move a goal's zone (the follow here, the planner's study-day POST).
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
    // Refused only for the learner's day (a valid, different zone): retry on their next one, unless
    // another writer moved the goal since the caller read it, whose day that wasn't.
    if (toZone === fromZone || !isValidTimeZone(toZone)) {
      return { kind: "unchanged", retryAt: readAt.getTime() };
    }

    if ((await readGoalZone(tx, { goalId, userId })) !== fromZone) {
      throw new TimeZoneUnchangedError("zoneChanged", readAt.getTime());
    }

    return { kind: "unchanged", retryAt: getNextDayStart(goal, readAt) };
  }

  const planInputs = movesTheDate({ goal, now: readAt, toZone });
  const { learnerRevision } = await markLearnerChanged(tx, { planInputs, userId });
  const lockedAt = new Date();

  // Another writer moved the goal while this waited: its day is no longer the one checked.
  if ((await readGoalZone(tx, { goalId, userId })) !== fromZone) {
    throw new TimeZoneUnchangedError("zoneChanged", lockedAt.getTime());
  }

  if (movesTheDate({ goal, now: lockedAt, toZone }) !== planInputs) {
    throw new TimeZoneUnchangedError("dayChanged", lockedAt.getTime());
  }

  if (!(await canMoveGoalTimeZone({ client: tx, goal, now: lockedAt, timeZone: toZone }))) {
    throw new TimeZoneUnchangedError("studied", getNextDayStart(goal, lockedAt));
  }

  const { count } = await tx.goal.updateMany({
    data: { timezone: toZone },
    where: { id: goalId, timezone: fromZone, userId },
  });

  if (count === 0) {
    throw new TimeZoneUnchangedError("zoneChanged", lockedAt.getTime());
  }

  return { kind: "moved", learnerRevision, planInputsChanged: planInputs };
}

/**
 * Follows the learner to their device's zone when a screen of the goal opens: a goal without a
 * zone stores it, and a learner who moved takes it while nothing was done yet in the goal's day
 * (see `moveGoalTimeZoneInTransaction`). A move returns the learner's revision, so the screen can
 * read itself again once; a goal that couldn't move says when it may (`retryAt`). A move that lost
 * a race to another writer, or to midnight, tries once more from a fresh read of the goal.
 */
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
      return followGoalTimeZone({ attempt: attempt + 1, goalId, timeZone });
    }

    return { moved: false, retryAt: error.retryAt, status: "ready" };
  }

  if (move.kind !== "moved") {
    return { moved: false, retryAt: move.retryAt, status: "ready" };
  }

  revalidateCacheTags([getGoalsCacheTag(userId), getLearnerModelCacheTag(userId)]);
  return { learnerRevision: String(move.learnerRevision), moved: true, status: "ready" };
}

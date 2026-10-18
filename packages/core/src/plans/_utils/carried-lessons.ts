import "server-only";
import { type StudySessionBlock, prisma } from "@zoonk/db";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { type PlanningMode } from "../planner/build-plan";
import { type CarryOver } from "../planner/carry-over";
import { addDays } from "../planner/plan-calendar";
import { parsePlanChangePayload } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { getTodayExceptAreas } from "./steered-areas";

/**
 * What the learner's last study day before today gave them and they didn't finish: its session's
 * lessons not done yet, in the session's order. Today's session isn't read, since a change made
 * today re-plans it as it is (see `followPlanChangeToday`).
 */
async function loadCarryOver({
  goalId,
  today,
}: {
  goalId: string;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
}): Promise<CarryOver> {
  // One flat read keeps the latest day authoritative even when that day has no unfinished lessons.
  const blocks = await prisma.$queryRaw<Pick<StudySessionBlock, "lessonId">[]>`
    SELECT block.lesson_id AS "lessonId"
    FROM study_session_blocks AS block
    WHERE block.session_id = (
      SELECT id FROM study_sessions
      WHERE goal_id = ${goalId}::uuid AND local_date < ${today}
      ORDER BY local_date DESC LIMIT 1
    )
    AND block.kind = 'learn'::"StudyBlockKind"
    AND block.lesson_id IS NOT NULL
    AND block.status IN ('pending'::"StudyBlockStatus", 'active'::"StudyBlockStatus")
    ORDER BY block.position ASC
  `;

  return { lessonIds: blocks.flatMap((block) => block.lessonId ?? []) };
}

/**
 * Whether the learner studied on the last day before today they opened Today (its session's day):
 * a lesson or challenge of the plan finished that day. False when they never opened it before. A
 * missed day may move phase ends (R6), a studied one never does.
 */
export async function wasLastDayStudied(
  context: Pick<PlanContext, "goal" | "items" | "timeZone" | "today">,
): Promise<boolean> {
  const session = await prisma.studySession.findFirst({
    orderBy: { localDate: "desc" },
    select: { localDate: true },
    where: { goalId: context.goal.id, localDate: { lt: context.today } },
  });

  if (!session) {
    return false;
  }

  const start = getStartOfLocalDay({ localDate: session.localDate, timeZone: context.timeZone });

  const end = getStartOfLocalDay({
    localDate: addDays(session.localDate, 1),
    timeZone: context.timeZone,
  });

  return context.items.some(
    (item) => item.completedAt !== null && item.completedAt >= start && item.completedAt < end,
  );
}

/**
 * Today's latest settling of what earlier days left, or null: a new day's (see `refreshGoalPlan`),
 * or a goal's back from a pause, which planned the paused days' lessons first itself (see
 * `computeResumedPlan`), so the day doesn't settle them again as missed days.
 */
async function loadTodaySettle(context: Pick<PlanContext, "plan" | "timeZone" | "today">) {
  const settled = await prisma.planChange.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, payload: true },
    where: {
      createdAt: {
        gte: getStartOfLocalDay({ localDate: context.today, timeZone: context.timeZone }),
      },
      kind: { in: ["missedDays", "resumed"] },
      planId: context.plan.id,
    },
  });

  return (
    settled && {
      createdAt: settled.createdAt,
      itemIds: parsePlanChangePayload(settled.payload).carriedItemIds,
    }
  );
}

/** The shared facts used by both the read's settling decision and its one compute. */
export async function loadPlanCarrySnapshot(context: PlanContext) {
  const [previous, settle] = await Promise.all([
    loadCarryOver({ goalId: context.goal.id, today: context.today }),
    loadTodaySettle(context),
  ]);

  return { previous, settle };
}

export type PlanCarrySnapshot = Awaited<ReturnType<typeof loadPlanCarrySnapshot>>;

/**
 * The lessons today's relearns brought back (see `bringBackMissedLessons`): a gap's lessons come
 * first. Taken by a later run that day as the plan's other lessons, a class test's relearned topic
 * went behind the work missed days left and out of the plan, its card still naming it (R19).
 */
async function loadTodayRelearnedItemIds(
  context: Pick<PlanContext, "plan" | "timeZone" | "today">,
): Promise<string[]> {
  const changes = await prisma.planChange.findMany({
    select: { payload: true },
    where: {
      createdAt: {
        gte: getStartOfLocalDay({ localDate: context.today, timeZone: context.timeZone }),
      },
      kind: "relearn",
      planId: context.plan.id,
      status: "applied",
    },
  });

  return changes.flatMap((change) => parsePlanChangePayload(change.payload).carriedItemIds);
}

/**
 * Today's last change of the plan's shape, applied: later runs that day lay the plan out as it did.
 * Undone changes don't count (the plan an undo gives back is the one before them).
 */
async function loadTodayEdit(context: Pick<PlanContext, "plan" | "timeZone" | "today">) {
  const change = await prisma.planChange.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, payload: true },
    where: {
      createdAt: {
        gte: getStartOfLocalDay({ localDate: context.today, timeZone: context.timeZone }),
      },
      kind: "edited",
      planId: context.plan.id,
      status: "applied",
    },
  });

  return (
    change && {
      createdAt: change.createdAt,
      operations: parsePlanChangePayload(change.payload).operations,
    }
  );
}

/**
 * What a planning run lays out first (see `CarryOver`): a forced run's, and an automatic run's on a
 * day that settled what earlier days left, that a change of focus steered or that a relearn
 * brought lessons back on, each with the items that settling carried and that relearn brought
 * back, and that focus's steering (the areas whose lessons it planned today again, see
 * `getTodayExceptAreas`), so every run that day lays the plan out as the settling and the changes
 * did. A change applied after the settling laid out the work it carried as the change asked, so
 * later automatic runs keep that plan: carried again, ENEM work the change had brought back was
 * set aside once more, without a card, and 227 items moved. Null for an automatic run on a day with
 * none of them.
 */
export async function loadPlanCarryOver({
  context,
  mode,
  snapshot,
}: {
  context: Pick<PlanContext, "goal" | "plan" | "timeZone" | "today">;
  mode: PlanningMode;
  snapshot?: PlanCarrySnapshot;
}): Promise<CarryOver | null> {
  const [settle, relearnedIds, edit] = await Promise.all([
    snapshot ? snapshot.settle : loadTodaySettle(context),
    loadTodayRelearnedItemIds(context),
    mode === "automatic" ? loadTodayEdit(context) : null,
  ]);

  const editedAfterSettle = settle !== null && edit !== null && edit.createdAt > settle.createdAt;
  const settledIds = settle && !editedAfterSettle ? settle.itemIds : null;
  const steered = edit ? getTodayExceptAreas(edit.operations) : null;

  if (mode === "automatic" && settledIds === null && relearnedIds.length === 0 && !steered) {
    return null;
  }

  const { lessonIds } =
    snapshot?.previous ?? (await loadCarryOver({ goalId: context.goal.id, today: context.today }));

  const itemIds = [...(settledIds ?? []), ...relearnedIds];

  return { itemIds, lessonIds, ...(steered && { todayExceptAreas: steered }) };
}

/**
 * Whether the learner was already shown today: its session was built with blocks. Lessons landing
 * then don't grow the day past the time it holds for them (see `putLandedLessons`).
 */
export async function isTodayShown({
  goalId,
  today,
}: {
  goalId: string;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
}): Promise<boolean> {
  const session = await prisma.studySession.findFirst({
    select: { id: true },
    where: { blocks: { some: {} }, goalId, localDate: today },
  });

  return session !== null;
}

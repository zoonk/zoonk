import "server-only";
import { type StudySessionBlock, prisma } from "@zoonk/db";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { type PlanningMode } from "../planner/build-plan";
import { type CarryOver } from "../planner/carry-over";
import { addDays } from "../planner/plan-calendar";
import { parsePlanChangePayload } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { getTodayExceptAreas } from "./steered-areas";

async function loadCarryOver({
  goalId,
  today,
}: {
  goalId: string;
  today: Date;
}): Promise<CarryOver> {
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

export async function loadPlanCarrySnapshot(context: PlanContext) {
  const [previous, settle] = await Promise.all([
    loadCarryOver({ goalId: context.goal.id, today: context.today }),
    loadTodaySettle(context),
  ]);

  return { previous, settle };
}

export type PlanCarrySnapshot = Awaited<ReturnType<typeof loadPlanCarrySnapshot>>;

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

export async function isTodayShown({
  goalId,
  today,
}: {
  goalId: string;
  today: Date;
}): Promise<boolean> {
  const session = await prisma.studySession.findFirst({
    select: { id: true },
    where: { blocks: { some: {} }, goalId, localDate: today },
  });

  return session !== null;
}

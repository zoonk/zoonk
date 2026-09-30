import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { changeGoalPlan } from "../plans/change-goal-plan";
import { decidePlanChange } from "../plans/decide-plan-change";
import { addDays, toIsoDate } from "../plans/planner/plan-calendar";
import { type PlanOperationError } from "../plans/planner/plan-operations";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { readBlockPayload } from "../sessions/block-payload";
import { type StudySessionTimeZoneInput } from "../sessions/contract";
import { getSession } from "../users/get-session";

const MONDAY = 1;
const DAYS_PER_WEEK = 7;

type WeeklyChallengeMove = { changeId: string | null; date: string };

export type MoveWeeklyChallengeResult =
  | { move: WeeklyChallengeMove; status: "moved" }
  | { error: PlanOperationError; status: "invalid" }
  | { status: "notFound" | "notMovable" | "unauthorized" };

export type UndoWeeklyChallengeMoveResult =
  | { status: "undone" }
  | { status: "conflict" | "notFound" | "unauthorized" };

/** The first Monday after a day: a Sunday's challenge moves to the next day. */
function getNextMonday(date: Date): Date {
  const days = (MONDAY - date.getUTCDay() + DAYS_PER_WEEK) % DAYS_PER_WEEK || DAYS_PER_WEEK;
  return addDays(date, days);
}

async function findWeeklyBlock(blockId: string) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const block = isUuid(blockId)
    ? await prisma.studySessionBlock.findFirst({
        include: { session: { select: { goalId: true, localDate: true } } },
        where: { id: blockId, kind: "checkpoint", session: { userId: session.user.id } },
      })
    : null;

  const payload = block ? readBlockPayload(block) : null;

  if (!block?.session.goalId || payload?.checkpoint?.kind !== "weekly" || !payload.planItemId) {
    return { status: "notFound" as const };
  }

  return {
    block,
    goalId: block.session.goalId,
    planItemId: payload.planItemId,
    status: "ready" as const,
  };
}

/**
 * "Move to Monday": the week's Big Challenge (a mock or a mixed challenge) moves from its day to
 * the next Monday, through the planner, so the plan and its undo stay in one place. Today's block
 * steps aside; the session never asks for a challenge that moved. Only the planner's own plans
 * (with a skill graph) can move it, since the planner is what places it again.
 */
export async function moveWeeklyChallenge({
  blockId,
  input,
}: {
  blockId: string;
  input: StudySessionTimeZoneInput;
}): Promise<MoveWeeklyChallengeResult> {
  const found = await findWeeklyBlock(blockId);

  if (found.status !== "ready") {
    return found;
  }

  const [item, plan] = await Promise.all([
    prisma.planItem.findUnique({ where: { id: found.planItemId } }),
    prisma.plan.findUnique({ select: { graph: true }, where: { goalId: found.goalId } }),
  ]);

  const planned = parsePlanGraph(plan?.graph).skills.length > 0;

  if (
    !planned ||
    found.block.status !== "pending" ||
    item?.status !== "todo" ||
    !item.scheduledFor
  ) {
    return { status: "notMovable" };
  }

  const to = getNextMonday(item.scheduledFor);

  const result = await changeGoalPlan({
    goalId: found.goalId,
    input: {
      operations: [
        { from: toIsoDate(item.scheduledFor), kind: "moveWeeklyEvent", to: toIsoDate(to) },
      ],
      timeZone: input.timeZone,
    },
  });

  if (result.status !== "applied") {
    return result;
  }

  await prisma.studySessionBlock.updateMany({
    data: { status: "skipped" },
    where: { id: found.block.id, status: "pending" },
  });

  return { move: { changeId: result.change?.id ?? null, date: toIsoDate(to) }, status: "moved" };
}

/** The challenge back on its day after an undo: a dated item is a new row once it moves. */
async function findChallengeOn({ date, planId }: { date: Date; planId: string }) {
  return prisma.planItem.findFirst({
    where: { kind: { in: ["checkpoint", "mock"] }, planId, scheduledFor: date, status: "todo" },
  });
}

/**
 * Undoes a move while the plan is as the move left it: the challenge goes back to its day and,
 * when that's the session's day, back into today's session.
 */
export async function undoWeeklyChallengeMove({
  blockId,
  changeId,
  input,
}: {
  blockId: string;
  changeId: string;
  input: StudySessionTimeZoneInput;
}): Promise<UndoWeeklyChallengeMoveResult> {
  const found = await findWeeklyBlock(blockId);

  if (found.status !== "ready") {
    return found;
  }

  const result = await decidePlanChange({
    changeId,
    goalId: found.goalId,
    input: { status: "undone", timeZone: input.timeZone },
  });

  if (result.status !== "updated") {
    return { status: result.status === "invalid" ? "conflict" : result.status };
  }

  const plan = await prisma.plan.findUnique({
    select: { id: true },
    where: { goalId: found.goalId },
  });

  const challenge = plan
    ? await findChallengeOn({ date: found.block.session.localDate, planId: plan.id })
    : null;

  if (challenge) {
    await prisma.studySessionBlock.updateMany({
      data: {
        payload: { ...readBlockPayload(found.block), planItemId: challenge.id },
        status: "pending",
      },
      where: { id: found.block.id, status: "skipped" },
    });
  }

  return { status: "undone" };
}

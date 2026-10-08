import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { decidePlanChange } from "../plans/decide-plan-change";
import { type PlanOperationError } from "../plans/planner/plan-operations";
import { readBlockPayload } from "../sessions/block-payload";
import { type StudySessionTimeZoneInput } from "../sessions/contract";
import { getSession } from "../users/get-session";
import {
  applyChallengeMove,
  findChallengeOn,
  getMovableDay,
  loadChallengeMoveRules,
  restoreChallengeBlock,
} from "./_utils/challenge-move";

type WeeklyChallengeMove = { changeId: string | null; date: string };

export type MoveWeeklyChallengeResult =
  | { move: WeeklyChallengeMove; status: "moved" }
  | { error: PlanOperationError; status: "invalid" }
  | { status: "notFound" | "notMovable" | "unauthorized" };

export type UndoWeeklyChallengeMoveResult =
  | { status: "undone" }
  | { status: "conflict" | "notFound" | "unauthorized" };

async function findWeeklyBlock(blockId: string) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const block = isUuid(blockId)
    ? await prisma.studySessionBlock.findFirst({
        include: { session: { include: { goal: true } } },
        where: { id: blockId, kind: "checkpoint", session: { userId: session.user.id } },
      })
    : null;

  const payload = block ? readBlockPayload(block) : null;
  const goal = block?.session.goal;

  if (!goal || payload?.checkpoint?.kind !== "weekly" || !payload.planItemId) {
    return { status: "notFound" as const };
  }

  return { block, goal, planItemId: payload.planItemId, status: "ready" as const };
}

/**
 * "Move to Monday" from today's session: the week's Big Challenge (a mock or a mixed challenge)
 * moves from its day to the next Monday, through the planner, and today's block steps aside. It
 * moves only before it starts, from its own day or a later one.
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

  const { block, goal, planItemId } = found;
  const timeZone = getAnswerTimeZone({ goal, timeZone: input.timeZone });
  const today = getDateInTimeZone({ date: new Date(), timeZone });

  const [item, rules] = await Promise.all([
    prisma.planItem.findUnique({ where: { id: planItemId } }),
    loadChallengeMoveRules(goal.id),
  ]);

  const from = getMovableDay({ item, rules, today });

  if (block.status !== "pending" || !item || !from) {
    return { status: "notMovable" };
  }

  const result = await applyChallengeMove({
    block,
    from,
    goalId: goal.id,
    input,
    planId: item.planId,
  });

  if (result.status !== "moved") {
    return result;
  }

  return { move: { changeId: result.move.changeId, date: result.move.date }, status: "moved" };
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
    goalId: found.goal.id,
    input: { status: "undone", timeZone: input.timeZone },
  });

  if (result.status !== "updated") {
    return { status: result.status === "invalid" ? "conflict" : result.status };
  }

  const plan = await prisma.plan.findUnique({
    select: { id: true },
    where: { goalId: found.goal.id },
  });

  const challenge = plan
    ? await findChallengeOn({ date: found.block.session.localDate, planId: plan.id })
    : null;

  if (challenge) {
    await restoreChallengeBlock({ block: found.block, challenge });
  }

  return { status: "undone" };
}

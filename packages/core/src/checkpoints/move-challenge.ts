import "server-only";
import { prisma } from "@zoonk/db";
import { decidePlanChange } from "../plans/decide-plan-change";
import { type PlanOperationError } from "../plans/planner/plan-operations";
import { readBlockPayload } from "../sessions/block-payload";
import { type StudySessionTimeZoneInput } from "../sessions/contract";
import {
  type ChallengeMove,
  applyChallengeMove,
  findChallengeOn,
  findMovedFrom,
  getMovableDay,
  loadChallengeMoveRules,
  restoreChallengeBlock,
} from "./_utils/challenge-move";
import {
  type OwnedChallenge,
  findChallengeBlock,
  findOwnedChallenge,
  getTodayBlock,
} from "./_utils/owned-challenge";

export type MoveChallengeResult =
  | { move: ChallengeMove; status: "moved" }
  | { error: PlanOperationError; status: "invalid" }
  | { status: "notFound" | "notMovable" | "unauthorized" };

export type UndoChallengeMoveResult =
  | { planItemId: string | null; status: "undone" }
  | { status: "conflict" | "notFound" | "unauthorized" };

/**
 * "Move to Monday" from the week's challenge's own page, before its day or on it: it moves to the
 * next Monday through the planner (a past day can't move, and a started one stays), and a block
 * of today's session for it steps aside. The move says the challenge's new plan item, since a
 * dated item is a new row once it moves.
 */
export async function moveChallenge({
  input,
  planItemId,
}: {
  input: StudySessionTimeZoneInput;
  planItemId: string;
}): Promise<MoveChallengeResult> {
  const owned = await findOwnedChallenge({ planItemId, timeZone: input.timeZone });

  if (owned.status !== "ready") {
    return owned;
  }

  const { challenge } = owned;

  const [block, rules] = await Promise.all([
    findChallengeBlock({ challenge }),
    loadChallengeMoveRules(challenge.goal.id),
  ]);

  const todayBlock = getTodayBlock({ block, today: challenge.today });
  const from = getMovableDay({ item: challenge.item, rules, today: challenge.today });

  if (!from || (todayBlock && todayBlock.status !== "pending")) {
    return { status: "notMovable" };
  }

  return applyChallengeMove({
    block: todayBlock,
    from,
    goalId: challenge.goal.id,
    input,
    planId: challenge.item.planId,
  });
}

/** Today's block that stepped aside for the move, so it comes back with the challenge. */
async function findSkippedWeeklyBlock(challenge: OwnedChallenge) {
  const blocks = await prisma.studySessionBlock.findMany({
    where: {
      kind: "checkpoint",
      session: { goalId: challenge.goal.id, localDate: challenge.today, userId: challenge.userId },
      status: "skipped",
    },
  });

  return blocks.find((block) => readBlockPayload(block).checkpoint?.kind === "weekly") ?? null;
}

/**
 * Undoes a move while the plan is as the move left it, from the challenge's new plan item: it
 * goes back to its day and, when that's today, back into today's session. The undo says the
 * challenge's plan item on its day again.
 */
export async function undoChallengeMove({
  changeId,
  input,
  planItemId,
}: {
  changeId: string;
  input: StudySessionTimeZoneInput;
  /** The challenge on the day it moved to. */
  planItemId: string;
}): Promise<UndoChallengeMoveResult> {
  const owned = await findOwnedChallenge({ planItemId, timeZone: input.timeZone });

  if (owned.status !== "ready") {
    return owned;
  }

  const { challenge } = owned;

  const result = await decidePlanChange({
    changeId,
    goalId: challenge.goal.id,
    input: { status: "undone", timeZone: input.timeZone },
  });

  if (result.status !== "updated") {
    return { status: result.status === "invalid" ? "conflict" : result.status };
  }

  const from = await findMovedFrom(changeId);

  const restored = from
    ? await findChallengeOn({ date: from, planId: challenge.item.planId })
    : null;

  const backToday = from?.getTime() === challenge.today.getTime();
  const block = restored && backToday ? await findSkippedWeeklyBlock(challenge) : null;

  if (restored && block) {
    await restoreChallengeBlock({ block, challenge: restored });
  }

  return { planItemId: restored?.id ?? null, status: "undone" };
}

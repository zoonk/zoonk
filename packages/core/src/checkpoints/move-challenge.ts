import "server-only";
import { prisma } from "@zoonk/db";
import { decidePlanChange } from "../plans/decide-plan-change";
import { type PlanChangeRefusal } from "../plans/planner/plan-operations";
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
  | PlanChangeRefusal
  | { status: "notFound" | "notMovable" | "unauthorized" };

export type UndoChallengeMoveResult =
  | { planItemId: string | null; status: "undone" }
  | { status: "conflict" | "notFound" | "unauthorized" };

/** Moves create a new dated plan item; use the returned id for subsequent requests. */
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
    userId: challenge.userId,
  });
}

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

/** Requires the moved challenge's new plan item and an unchanged plan; returns its restored item. */
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
    await restoreChallengeBlock({ block, challenge: restored, userId: challenge.userId });
  }

  return { planItemId: restored?.id ?? null, status: "undone" };
}

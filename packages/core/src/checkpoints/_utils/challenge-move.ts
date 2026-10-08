import "server-only";
import { type PlanItem, type StudySessionBlock, prisma } from "@zoonk/db";
import { parsePlanChangePayload } from "../../plans/_utils/plan-change-payload";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import { addDays, fromIsoDate, toIsoDate } from "../../plans/planner/plan-calendar";
import { type PlanOperationError } from "../../plans/planner/plan-operations";
import { parsePlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";
import { readBlockPayload } from "../../sessions/block-payload";
import { type StudySessionTimeZoneInput } from "../../sessions/contract";
import { isWeeklyChallengeItem } from "./load-weekly-challenge";

const MONDAY = 1;
const DAYS_PER_WEEK = 7;

/** Where the week's challenge went: its new day, its plan item there and the change to undo. */
export type ChallengeMove = { changeId: string | null; date: string; planItemId: string | null };

export type ApplyChallengeMoveResult =
  | { move: ChallengeMove; status: "moved" }
  | { error: PlanOperationError; status: "invalid" }
  | { status: "notFound" | "unauthorized" };

/** The first Monday after a day: a Sunday's challenge moves to the next day. */
function getNextMonday(date: Date): Date {
  const days = (MONDAY - date.getUTCDay() + DAYS_PER_WEEK) % DAYS_PER_WEEK || DAYS_PER_WEEK;
  return addDays(date, days);
}

/**
 * What decides whether the week's challenge can move: only the planner's own plans (with a skill
 * graph) can move it, since the planner places it again, a challenge it already moved stays on
 * its new day (its undo brings it back), and nothing moves onto or past the goal's date.
 */
export type ChallengeMoveRules = { movedTo: string[]; planned: boolean; targetDate: Date | null };

export async function loadChallengeMoveRules(goalId: string): Promise<ChallengeMoveRules> {
  const plan = await prisma.plan.findUnique({
    select: { goal: { select: { targetDate: true } }, graph: true, settings: true },
    where: { goalId },
  });

  return {
    movedTo: parsePlanSettings(plan?.settings).movedEvents.map((move) => move.to),
    planned: parsePlanGraph(plan?.graph).skills.length > 0,
    targetDate: plan?.goal.targetDate ?? null,
  };
}

/**
 * The day the week's challenge can move from, or null when it can't move: it's waiting, its day is
 * today or later (a past day can't move), the planner owns the plan, it hasn't moved already and
 * the Monday it would move to comes before the goal's date (a mock after a Friday test is no
 * practice for it).
 */
export function getMovableDay({
  item,
  rules,
  today,
}: {
  item: PlanItem | null;
  rules: ChallengeMoveRules;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
}): Date | null {
  const day = item?.scheduledFor ?? null;
  const waiting = rules.planned && item && isWeeklyChallengeItem(item) && item.status === "todo";
  const moved = day !== null && rules.movedTo.includes(toIsoDate(day));
  const beforeDate = (date: Date) => !rules.targetDate || date < rules.targetDate;

  return waiting && day && day >= today && !moved && beforeDate(getNextMonday(day)) ? day : null;
}

/** The week's challenge on a day: a dated item is a new row once it moves. */
export function findChallengeOn({ date, planId }: { date: Date; planId: string }) {
  return prisma.planItem.findFirst({
    where: { kind: { in: ["checkpoint", "mock"] }, planId, scheduledFor: date, status: "todo" },
  });
}

/**
 * "Move to Monday" through the planner, so the plan and its undo stay in one place: the item
 * moves to the next Monday and a block of today's session for it steps aside.
 */
export async function applyChallengeMove({
  block,
  from,
  goalId,
  input,
  planId,
}: {
  block: Pick<StudySessionBlock, "id"> | null;
  /** The day it's planned for now. */
  from: Date;
  goalId: string;
  input: StudySessionTimeZoneInput;
  planId: string;
}): Promise<ApplyChallengeMoveResult> {
  const to = getNextMonday(from);

  const result = await changeGoalPlan({
    goalId,
    input: {
      operations: [{ from: toIsoDate(from), kind: "moveWeeklyEvent", to: toIsoDate(to) }],
      timeZone: input.timeZone,
    },
  });

  // Only choosing where to focus comes back unchanged; a move always changes the week.
  if (result.status === "unchanged") {
    return { status: "notFound" };
  }

  if (result.status !== "applied") {
    return result;
  }

  const [moved] = await Promise.all([
    findChallengeOn({ date: to, planId }),
    block
      ? prisma.studySessionBlock.updateMany({
          data: { status: "skipped" },
          where: { id: block.id, status: "pending" },
        })
      : null,
  ]);

  return {
    move: {
      changeId: result.change?.id ?? null,
      date: toIsoDate(to),
      planItemId: moved?.id ?? null,
    },
    status: "moved",
  };
}

/** The day a move took the challenge from, read from its plan change. */
export async function findMovedFrom(changeId: string): Promise<Date | null> {
  const change = await prisma.planChange.findUnique({ where: { id: changeId } });
  const payload = change ? parsePlanChangePayload(change.payload) : null;
  const operation = payload?.operations.find((entry) => entry.kind === "moveWeeklyEvent");

  return operation?.kind === "moveWeeklyEvent" ? fromIsoDate(operation.from) : null;
}

/** After an undo on the challenge's own day, its block comes back into today's session. */
export async function restoreChallengeBlock({
  block,
  challenge,
}: {
  block: Pick<StudySessionBlock, "id" | "payload">;
  challenge: Pick<PlanItem, "id">;
}): Promise<void> {
  await prisma.studySessionBlock.updateMany({
    data: { payload: { ...readBlockPayload(block), planItemId: challenge.id }, status: "pending" },
    where: { id: block.id, status: "skipped" },
  });
}

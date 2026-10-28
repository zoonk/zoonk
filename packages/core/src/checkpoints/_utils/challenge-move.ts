import "server-only";
import { type PlanItem, type StudySessionBlock, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { parsePlanChangePayload } from "../../plans/_utils/plan-change-payload";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import {
  addDays,
  fromIsoDate,
  getWeekdayMinutes,
  toIsoDate,
} from "../../plans/planner/plan-calendar";
import { type PlanEffect } from "../../plans/planner/plan-effect";
import { type PlanChangeRefusal } from "../../plans/planner/plan-operations";
import { parsePlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";
import { isWeeklyMoveDateAllowed } from "../../plans/planner/weekly-move-date";
import { readBlockPayload } from "../../sessions/block-payload";
import { type StudySessionTimeZoneInput } from "../../sessions/contract";
import { isWeeklyChallengeItem } from "./load-weekly-challenge";

const MONDAY = 1;
const DAYS_PER_WEEK = 7;

export type ChallengeMove = { changeId: string | null; date: string; planItemId: string | null };

export type ApplyChallengeMoveResult =
  | { move: ChallengeMove; status: "moved" }
  | PlanChangeRefusal
  | { status: "notFound" | "unauthorized" };

function getNextMonday(date: Date): Date {
  const days = (MONDAY - date.getUTCDay() + DAYS_PER_WEEK) % DAYS_PER_WEEK || DAYS_PER_WEEK;
  return addDays(date, days);
}

export type ChallengeMoveRules = {
  heldDays: string[];
  mondayOpen: boolean;
  movedTo: string[];
  planned: boolean;
  targetDate: Date | null;
};

export async function loadChallengeMoveRules(goalId: string): Promise<ChallengeMoveRules> {
  const plan = await prisma.plan.findUnique({
    select: {
      goal: { select: { dailyMinutes: true, targetDate: true } },
      graph: true,
      items: {
        select: { scheduledFor: true },
        where: {
          kind: { in: ["checkpoint", "mock"] },
          scheduledFor: { not: null },
          status: "todo",
        },
      },
      settings: true,
    },
    where: { goalId },
  });

  const settings = parsePlanSettings(plan?.settings);

  return {
    heldDays: (plan?.items ?? []).flatMap((item) =>
      item.scheduledFor ? [toIsoDate(item.scheduledFor)] : [],
    ),
    mondayOpen:
      getWeekdayMinutes({
        calendar: {
          dailyMinutes: plan?.goal.dailyMinutes ?? 0,
          weekdayMinutes: settings.weekdayMinutes,
        },
        weekday: MONDAY,
      }) > 0,
    movedTo: settings.movedEvents.map((move) => move.to),
    planned: parsePlanGraph(plan?.graph).skills.length > 0,
    targetDate: plan?.goal.targetDate ?? null,
  };
}

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

export function canMoveToMonday(input: Parameters<typeof getMovableDay>[0]): boolean {
  const day = getMovableDay(input);
  const monday = day && toIsoDate(getNextMonday(day));
  const { rules } = input;

  return (
    monday !== null &&
    isWeeklyMoveDateAllowed({ to: fromIsoDate(monday), today: input.today }) &&
    rules.mondayOpen &&
    !rules.heldDays.includes(monday) &&
    !rules.movedTo.includes(monday)
  );
}

export function findChallengeOn({ date, planId }: { date: Date; planId: string }) {
  return prisma.planItem.findFirst({
    where: { kind: { in: ["checkpoint", "mock"] }, planId, scheduledFor: date, status: "todo" },
  });
}

export async function applyChallengeMove({
  block,
  from,
  goalId,
  input,
  planId,
  userId,
}: {
  block: Pick<StudySessionBlock, "id"> | null;
  from: Date;
  goalId: string;
  input: StudySessionTimeZoneInput;
  planId: string;
  userId: string;
}): Promise<ApplyChallengeMoveResult> {
  const to = getNextMonday(from);

  const result = await changeGoalPlan({
    goalId,
    input: {
      operations: [{ from: toIsoDate(from), kind: "moveWeeklyEvent", to: toIsoDate(to) }],
      timeZone: input.timeZone,
    },
  });

  if (result.status === "unchanged") {
    return { status: "notFound" };
  }

  if (result.status !== "applied") {
    return result;
  }

  const [moved] = await Promise.all([
    findChallengeOn({ date: to, planId }),
    block
      ? writeLearnerChange({ userId }, async (tx) => {
          const changed = await tx.studySessionBlock.updateMany({
            data: { status: "skipped" },
            where: { id: block.id, status: "pending" },
          });

          return changed.count === 0 ? unchanged(null) : null;
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

export async function findMovedFrom(changeId: string): Promise<Date | null> {
  const change = await prisma.planChange.findUnique({ where: { id: changeId } });
  const payload = change ? parsePlanChangePayload(change.payload) : null;
  const operation = payload?.operations.find((entry) => entry.kind === "moveWeeklyEvent");

  return operation?.kind === "moveWeeklyEvent" ? fromIsoDate(operation.from) : null;
}

export async function restoreChallengeBlock({
  block,
  challenge,
  userId,
}: {
  block: Pick<StudySessionBlock, "id" | "payload">;
  challenge: Pick<PlanItem, "id">;
  userId: string;
}): Promise<void> {
  await writeLearnerChange({ userId }, async (tx) => {
    const changed = await tx.studySessionBlock.updateMany({
      data: {
        payload: { ...readBlockPayload(block), planItemId: challenge.id },
        status: "pending",
      },
      where: { id: block.id, status: "skipped" },
    });

    return changed.count === 0 ? unchanged(null) : null;
  });
}

export async function loadMoveEffect({
  changeId,
  planId,
}: {
  changeId: string;
  planId: string;
}): Promise<PlanEffect | null> {
  const change = isUuid(changeId)
    ? await prisma.planChange.findFirst({ where: { id: changeId, planId } })
    : null;

  const payload = change ? parsePlanChangePayload(change.payload) : null;
  const moves = payload?.operations.some((operation) => operation.kind === "moveWeeklyEvent");

  return moves ? (payload?.effect ?? null) : null;
}

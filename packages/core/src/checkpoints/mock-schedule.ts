import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { oweGoalLessons } from "../follow-ups/owe-goal-lessons";
import { commitPlan } from "../plans/_utils/commit-plan";
import { followPlanToday } from "../plans/_utils/follow-plan-today";
import { findOwnedPlan } from "../plans/_utils/owned-plan";
import { parsePlanChangePayload, toPlanChangePayload } from "../plans/_utils/plan-change-payload";
import { computePlan } from "../plans/_utils/replan";
import { decidePlanChange } from "../plans/decide-plan-change";
import { unlessPlanConflict } from "../plans/plan-conflict";
import {
  addDays,
  daysBetween,
  fromIsoDate,
  getEndOfWeek,
  getWeekdayMinutes,
  toIsoDate,
} from "../plans/planner/plan-calendar";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { getSession } from "../users/get-session";
import { findMockProgress, removeUnstartedMockBlocks } from "./_utils/mock-schedule-blocks";
import { rescheduleMock } from "./_utils/mock-schedule-settings";
import { type OwnedChallenge, findOwnedChallenge } from "./_utils/owned-challenge";

type Request = { planItemId: string; timeZone?: string };
const unavailable = { status: "notMovable" } as const;
const conflict = { status: "conflict" } as const;
const source = "mockSchedule";

function datesFor({ goal, item, items, plan, today }: OwnedChallenge) {
  if (
    goal.kind !== "exam" ||
    goal.status !== "active" ||
    item.kind !== "mock" ||
    item.status !== "todo" ||
    !item.scheduledFor ||
    (goal.targetDate !== null && today >= goal.targetDate && item.scheduledFor < goal.targetDate)
  ) {
    return null;
  }

  const from = item.scheduledFor;
  const settings = parsePlanSettings(plan.settings);
  const calendar = { dailyMinutes: goal.dailyMinutes, weekdayMinutes: settings.weekdayMinutes };

  const challenges = items.filter(
    (other) =>
      other.id !== item.id &&
      other.status !== "skipped" &&
      ["boss", "checkpoint", "mock"].includes(other.kind),
  );

  const held = new Set(
    challenges.flatMap((other) => (other.scheduledFor ? [toIsoDate(other.scheduledFor)] : [])),
  );

  const next = challenges.flatMap((other) =>
    other.kind === "mock" && other.scheduledFor && other.scheduledFor > from
      ? [other.scheduledFor.getTime()]
      : [],
  );

  const start = from > today ? from : today;

  const last = Math.max(
    start.getTime(),
    ...items.flatMap((other) => other.scheduledFor?.getTime() ?? []),
  );

  const end = new Date(
    Math.min(
      goal.targetDate && from <= goal.targetDate
        ? goal.targetDate.getTime()
        : addDays(new Date(last), 1).getTime(),
      ...next,
    ),
  );

  return Array.from({ length: Math.max(0, daysBetween(start, end) - 1) }, (_, index) =>
    addDays(start, index + 1),
  )
    .filter(
      (date) =>
        !held.has(toIsoDate(date)) &&
        getWeekdayMinutes({ calendar, weekday: date.getUTCDay() }) > 0,
    )
    .map((date) => toIsoDate(date));
}

async function loadSchedule(request: Request) {
  const owned = await findOwnedChallenge(request);

  if (owned.status !== "ready") {
    return owned;
  }

  const dates = datesFor(owned.challenge);

  if (
    !dates ||
    (await findMockProgress({
      client: prisma,
      goalId: owned.challenge.goal.id,
      planItemId: request.planItemId,
    }))
  ) {
    return unavailable;
  }

  return { ...owned, dates };
}

export async function getMockSchedule(request: Request) {
  const result = await loadSchedule(request);
  return result.status === "ready" ? { dates: result.dates, status: "ready" as const } : result;
}

export async function changeMockSchedule({
  planItemId,
  input,
}: {
  planItemId: string;
  input: { date: string | null; timeZone?: string };
}) {
  const result = await loadSchedule({ planItemId, timeZone: input.timeZone });

  if (result.status !== "ready") {
    return result;
  }

  const { challenge } = result;
  const to = input.date;

  if (to !== null && !result.dates.includes(to)) {
    return unavailable;
  }

  const owned = await findOwnedPlan({ goalId: challenge.goal.id, timeZone: input.timeZone });

  if (owned.status !== "ready") {
    return owned;
  }

  const { context } = owned;

  if (
    context.plan.version !== challenge.plan.version ||
    context.plan.inputVersion !== challenge.plan.inputVersion ||
    !challenge.item.scheduledFor
  ) {
    return conflict;
  }

  const from = toIsoDate(challenge.item.scheduledFor);

  const state = {
    ...context.state,
    settings: await rescheduleMock({
      challenge,
      date: challenge.item.scheduledFor,
      settings: context.state.settings,
      to,
    }),
  };

  const mode = to && fromIsoDate(to) <= getEndOfWeek(context.today) ? "forced" : "automatic";

  const computed = await computePlan({
    context: { ...context, items: context.items.filter((item) => item.id !== planItemId) },
    keepPhaseDates: true,
    mode,
    pace: "saved",
    state,
  });

  const mockOn = (day: string) =>
    computed.built.items.some(
      (item) =>
        item.kind === "mock" &&
        item.status === "todo" &&
        item.scheduledFor &&
        toIsoDate(item.scheduledFor) === day,
    );

  if (mockOn(from) || (to && !mockOn(to))) {
    return unavailable;
  }

  const changeId = await unlessPlanConflict(() =>
    commitPlan({
      change: {
        kind: "edited",
        payload: toPlanChangePayload({
          effect: computed.effect,
          mockSchedule: { from, to },
          planItemIds: [planItemId],
          source,
        }),
        reason: "Changed the schedule for one mock exam.",
        status: "applied",
      },
      changeDay: async (tx) => {
        await removeUnstartedMockBlocks({
          goalId: challenge.goal.id,
          planItemId,
          today: context.today,
          tx,
        });

        await oweGoalLessons({ db: tx, goalId: challenge.goal.id, userId: challenge.userId });
      },
      computed,
      context,
    }),
  );

  if (!changeId) {
    return conflict;
  }

  await followPlanToday({ changeId, context });

  const moved = to
    ? await prisma.planItem.findFirst({
        select: { id: true },
        where: {
          kind: "mock",
          planId: context.plan.id,
          scheduledFor: fromIsoDate(to),
          status: "todo",
        },
      })
    : null;

  return { changeId, planItemId: moved?.id ?? planItemId, status: "changed" as const };
}

export async function undoMockSchedule({
  planItemId,
  changeId,
  timeZone,
}: Request & { changeId: string }) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const change = isUuid(changeId)
    ? await prisma.planChange.findFirst({
        select: { payload: true, plan: { select: { goalId: true } } },
        where: { id: changeId, plan: { goal: { userId: session.user.id } } },
      })
    : null;

  const payload = change && parsePlanChangePayload(change.payload);

  if (!change || payload?.source !== source || !payload.planItemIds.includes(planItemId)) {
    return { status: "notFound" as const };
  }

  const result = await unlessPlanConflict(() =>
    decidePlanChange({
      changeId,
      goalId: change.plan.goalId,
      input: { status: "undone", timeZone },
      trackAnalytics: false,
    }),
  );

  return result?.status === "updated" ? { status: "undone" as const } : conflict;
}

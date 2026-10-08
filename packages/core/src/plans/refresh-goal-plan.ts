import "server-only";
import { prisma } from "@zoonk/db";
import { getStartOfLocalDay } from "../learner/_utils/local-time";
import { isPlanReady } from "./_utils/apply-plan-change";
import { loadCarryOver } from "./_utils/carried-lessons";
import { getFallingBehind } from "./_utils/falling-behind";
import { toPlanChangePayload } from "./_utils/plan-change-payload";
import { type PlanContext, loadPlanContext } from "./_utils/plan-context";
import {
  type ComputedPlan,
  type PlanChangeRecord,
  type PlanTagRevalidation,
  commitPlan,
  computePlan,
  isPlanUnchanged,
  withPlanRetry,
} from "./_utils/replan";
import { type CarryOver } from "./planner/carry-over";
import { isMorePrecise } from "./planner/plan-pace";

type PlanRefreshResult = { status: "notFound" | "notReady" | "paused" | "refreshed" | "unchanged" };

/** Plain notes for logs and admin; the apps say these changes from their kind and numbers. */
const LEFT_WORK_NOTE = "Lessons earlier days left come first; the rest of the plan moved forward.";
const MORE_PRECISE_NOTE = "The estimate now uses a closer pace.";

const LEARN_KINDS = new Set(["chapter", "lesson"]);

/**
 * The work earlier days left that today doesn't start with yet: lessons due before today, and
 * lessons the last study day gave the learner that the plan has after today. Once today settled
 * them, those that didn't fit today come first tomorrow: they aren't left again (`settledToday`).
 */
function findLeftWork({
  carryOver,
  context,
  settledToday,
}: {
  carryOver: CarryOver;
  context: PlanContext;
  settledToday: boolean;
}) {
  const given = new Set(settledToday ? [] : carryOver.lessonIds);
  const { today } = context;

  return context.items.filter(
    (item) =>
      item.status === "todo" &&
      LEARN_KINDS.has(item.kind) &&
      item.scheduledFor !== null &&
      (item.scheduledFor < today ||
        (item.lessonId !== null && given.has(item.lessonId) && item.scheduledFor > today)),
  );
}

/** Whether today already settled what earlier days left (see `settleLeftWork`). */
async function hasSettledToday(context: PlanContext): Promise<boolean> {
  const settled = await prisma.planChange.findFirst({
    select: { id: true },
    where: {
      createdAt: {
        gte: getStartOfLocalDay({ localDate: context.today, timeZone: context.timeZone }),
      },
      kind: "missedDays",
      planId: context.plan.id,
    },
  });

  return settled !== null;
}

/** The earlier days that left work: the days it was due, or the last study day for the rest. */
function countLeftDays({ context, left }: { context: PlanContext; left: PlanContext["items"] }) {
  const overdue = left.filter((item) => item.scheduledFor && item.scheduledFor < context.today);
  const days = new Set(overdue.map((item) => item.scheduledFor?.getTime())).size;

  return Math.max(1, days);
}

/**
 * A new day settles what earlier days left: it comes first, in the order it was planned, and the
 * rest of the plan moves forward from today at the pace the learner's progress sets. Said once on
 * the plan, and on Today when falling behind now covers less of the goal by its date.
 */
async function settleLeftWork({
  context,
  left,
  pace,
  revalidation,
}: {
  context: PlanContext;
  left: PlanContext["items"];
  pace: "sampled" | "saved";
  revalidation: PlanTagRevalidation;
}): Promise<PlanRefreshResult> {
  const computed = await computePlan({ context, mode: "forced", pace });

  await commitPlan({
    change: {
      kind: "missedDays",
      payload: toPlanChangePayload({
        behind: getFallingBehind({ computed, context }),
        carriedItemIds: left.map((item) => item.id),
        days: countLeftDays({ context, left }),
        effect: computed.effect,
        source: "system",
      }),
      reason: LEFT_WORK_NOTE,
      status: "applied",
    },
    computed,
    context,
    revalidation,
  });

  return { status: "refreshed" };
}

function getPaceChange({
  computed,
  context,
}: {
  computed: ComputedPlan;
  context: PlanContext;
}): PlanChangeRecord | null {
  if (!isMorePrecise({ next: computed.pace, previous: context.state.settings.pace })) {
    return null;
  }

  return {
    kind: "estimateUpdated",
    payload: toPlanChangePayload({ effect: computed.effect, source: "system" }),
    reason: MORE_PRECISE_NOTE,
    status: "applied",
  };
}

/**
 * Keeps an active goal's plan current, and only changes it when something did: a new day settles
 * what earlier days left (see `settleLeftWork`); lessons the Library outlined since take their
 * skill's place, this week's in place of their stand-ins; and after a session (`sampled`), the pace
 * the learner's progress sets moves what comes after this week (a closer pace is announced once).
 * Opening a screen reads the saved pace (`saved`), so a day that only begins changes nothing. Writes
 * nothing when the work and its time stayed the same, wherever a new run would lay it. Does nothing
 * for paused goals or plans not built yet.
 */
export async function refreshGoalPlan({
  goalId,
  pace = "saved",
  revalidation = "now",
}: {
  goalId: string;
  /** `sampled` after the learner's progress (a session ended); `saved` otherwise. */
  pace?: "sampled" | "saved";
  /** Building a day while a page renders can't clear caches, and has none to clear. */
  revalidation?: PlanTagRevalidation;
}): Promise<PlanRefreshResult> {
  return withPlanRetry(async () => {
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });

    if (!goal) {
      return { status: "notFound" };
    }

    if (goal.status !== "active") {
      return { status: "paused" };
    }

    const context = await loadPlanContext({ goal });

    if (!context || !isPlanReady(context)) {
      return { status: context ? "notReady" : "notFound" };
    }

    const [carryOver, settledToday] = await Promise.all([
      loadCarryOver({ goalId, today: context.today }),
      hasSettledToday(context),
    ]);

    const left = findLeftWork({ carryOver, context, settledToday });

    if (left.length > 0) {
      return settleLeftWork({ context, left, pace, revalidation });
    }

    const computed = await computePlan({ context, mode: "automatic", pace });

    const change = getPaceChange({ computed, context });

    if (!change && isPlanUnchanged({ computed, context })) {
      return { status: "unchanged" };
    }

    await commitPlan({ change, computed, context, revalidation });

    return { status: "refreshed" };
  });
}

import "server-only";
import { prisma } from "@zoonk/db";
import { isPlanReady } from "./_utils/apply-plan-change";
import { toPlanChangePayload } from "./_utils/plan-change-payload";
import { type PlanContext, loadPlanContext } from "./_utils/plan-context";
import {
  type ComputedPlan,
  type PlanChangeRecord,
  type PlanTagRevalidation,
  commitPlan,
  computePlan,
  withPlanRetry,
} from "./_utils/replan";
import { toIsoDate } from "./planner/plan-calendar";
import { isMorePrecise } from "./planner/plan-pace";

type PlanRefreshResult = { status: "notFound" | "notReady" | "paused" | "refreshed" | "unchanged" };

/** Plain notes for logs and admin; the apps say these changes from their kind and numbers. */
const MISSED_DAYS_NOTE = "Missed days moved the rest of the plan forward.";
const MORE_PRECISE_NOTE = "The estimate now uses a closer pace.";

function getMissedDays(context: PlanContext): number {
  const overdue = context.items.filter(
    (item) =>
      item.status === "todo" &&
      item.kind === "lesson" &&
      item.scheduledFor &&
      item.scheduledFor < context.today,
  );

  return new Set(overdue.map((item) => item.scheduledFor?.getTime())).size;
}

function getChange({
  computed,
  context,
  missedDays,
}: {
  computed: ComputedPlan;
  context: PlanContext;
  missedDays: number;
}): PlanChangeRecord | null {
  if (missedDays > 0) {
    return {
      kind: "missedDays",
      payload: toPlanChangePayload({ days: missedDays, effect: computed.effect, source: "system" }),
      reason: MISSED_DAYS_NOTE,
      status: "applied",
    };
  }

  if (isMorePrecise({ next: computed.pace, previous: context.state.settings.pace })) {
    return {
      kind: "estimateUpdated",
      payload: toPlanChangePayload({ effect: computed.effect, source: "system" }),
      reason: MORE_PRECISE_NOTE,
      status: "applied",
    };
  }

  return null;
}

function toDay(date: Date | null): string | null {
  return date ? toIsoDate(date) : null;
}

/** Nothing moved: same items in the same order on the same days, and the same pace. */
function isUnchanged({
  computed,
  context,
}: {
  computed: ComputedPlan;
  context: PlanContext;
}): boolean {
  const { items } = computed.built;
  const samePace = JSON.stringify(computed.pace) === JSON.stringify(context.state.settings.pace);

  return (
    samePace &&
    items.length === context.items.length &&
    items.every((item, index) => {
      const current = context.items[index];

      return (
        current !== undefined &&
        item.id === current.id &&
        item.phase === current.phase &&
        toDay(item.scheduledFor) === toDay(current.scheduledFor)
      );
    })
  );
}

/**
 * Keeps an active goal's plan current: missed days re-flow from today instead of piling up
 * (announced once), a closer pace makes the estimate more precise (announced once), and lessons
 * the Library outlined since take the place of their skill. This week stays as it is unless days
 * were missed. Does nothing for paused goals or plans not built yet, and writes nothing when
 * nothing moved.
 */
export async function refreshGoalPlan({
  goalId,
  revalidation = "now",
}: {
  goalId: string;
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

    const missedDays = getMissedDays(context);

    const computed = await computePlan({ context, mode: missedDays > 0 ? "forced" : "automatic" });

    const change = getChange({ computed, context, missedDays });

    if (!change && isUnchanged({ computed, context })) {
      return { status: "unchanged" };
    }

    await commitPlan({ change, computed, context, revalidation });

    return { status: "refreshed" };
  });
}

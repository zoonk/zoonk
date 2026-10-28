import "server-only";
import { prisma } from "@zoonk/db";
import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getUserSubscriptionCacheTag,
} from "../../cache/tags";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { getSession } from "../../users/get-session";
import { type PlanChangeView } from "../plan-view-contract";
import { parsePlanGraph } from "../planner/plan-state";
import { foldChangeAreas } from "./fold-part-areas";
import { loadGraphPartAreas } from "./part-areas";
import { changeGoalSelect, toPlanChangeView } from "./plan-change-view";
import { type PlanContext, loadPlanContext } from "./plan-context";
import { loadPlanAtToken } from "./plan-token";

export type OwnedPlan =
  | { context: PlanContext; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/** The signed-in learner's plan for a goal; another learner's goal is "not found". */
export async function findOwnedPlan({
  goalId,
  timeZone,
}: {
  goalId: string;
  timeZone?: string | null;
}): Promise<OwnedPlan> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const context = await loadPlanAtToken(goalId, { timeZone });

  return context?.goal.userId === session.user.id
    ? { context, status: "ready" }
    : { status: "notFound" };
}

/**
 * The signed-in learner's plan for a cached read (`"use cache: private"`): the plan's views share
 * ownership, the learner's date (the goal's timezone, then the request's), the context and the
 * invalidation tags, so a plan write reaches every one of them.
 */
export async function loadOwnedPlanContext(
  goalId: string,
): Promise<
  { context: PlanContext; now: Date; status: "ready" } | { status: "notFound" | "unauthorized" }
> {
  // The request's date doesn't depend on the goal: it's read alongside it.
  const [owned, { currentInstant, timeZone }] = await Promise.all([
    findOwnedGoal(goalId),
    getRequestProgressDateContext(),
  ]);

  if (owned.status !== "ready") {
    return owned;
  }

  cacheTag(
    getGoalsCacheTag(owned.userId),
    getLearnerModelCacheTag(owned.userId),
    getUserSubscriptionCacheTag(owned.userId),
  );

  const goalZone = owned.goal.timezone;

  const context = await loadPlanContext({
    goal: owned.goal,
    now: currentInstant,
    timeZone: goalZone && isValidTimeZone(goalZone) ? goalZone : timeZone,
  });

  if (!context) {
    return { status: "notFound" };
  }

  return { context, now: currentInstant, status: "ready" };
}

/** A change as the learner sees it right after it happened. */
export async function loadPlanChangeView(changeId: string): Promise<PlanChangeView> {
  const change = await prisma.planChange.findUniqueOrThrow({
    include: {
      plan: {
        select: {
          goal: { select: { ...changeGoalSelect, examBlueprintId: true } },
          graph: true,
          version: true,
        },
      },
    },
    where: { id: changeId },
  });

  const { goal, graph, version } = change.plan;

  const partAreas = await loadGraphPartAreas({
    examBlueprintId: goal.examBlueprintId,
    graph: parsePlanGraph(graph),
  });

  return foldChangeAreas({
    change: await toPlanChangeView({ change, goal, planVersion: version }),
    partAreas,
  });
}

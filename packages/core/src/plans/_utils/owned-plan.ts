import "server-only";
import { prisma } from "@zoonk/db";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { type PlanChangeView } from "../plan-view-contract";
import { toPlanChangeView } from "./plan-change-view";
import { type PlanContext, loadPlanContext } from "./plan-context";

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
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const context = await loadPlanContext({ goal: owned.goal, timeZone });

  return context ? { context, status: "ready" } : { status: "notFound" };
}

/** A change as the learner sees it right after it happened. */
export async function loadPlanChangeView(changeId: string): Promise<PlanChangeView> {
  const change = await prisma.planChange.findUniqueOrThrow({
    include: { plan: { select: { version: true } } },
    where: { id: changeId },
  });

  return toPlanChangeView({ change, planVersion: change.plan.version });
}

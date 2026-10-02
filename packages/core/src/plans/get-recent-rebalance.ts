import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { REBALANCE_SOURCE } from "../preparation/rebalance-rule";
import { toPlanChangeView } from "./_utils/plan-change-view";
import { type PlanChangeView } from "./plan-view-contract";

/** A rebalance is news for a week: after that it's simply how the plan is. */
const RECENT_DAYS = 7;

export type RecentRebalanceResult =
  | { change: PlanChangeView | null; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/**
 * The plan's latest rebalance from this week, if any: time moved to the area that needs it after
 * a session. Today and Progress show it as one line (the buddy's in Fun) with its undo; the plan's
 * changes list it too.
 */
export async function getRecentRebalance(goalId: string): Promise<RecentRebalanceResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const plan = await prisma.plan.findUnique({
    select: { id: true, version: true },
    where: { goalId },
  });

  const change = plan
    ? await prisma.planChange.findFirst({
        orderBy: { createdAt: "desc" },
        where: {
          createdAt: { gte: new Date(Date.now() - RECENT_DAYS * MS_PER_DAY) },
          payload: { equals: REBALANCE_SOURCE, path: ["source"] },
          planId: plan.id,
          status: { in: ["applied", "proposed"] },
        },
      })
    : null;

  return {
    change: plan && change ? toPlanChangeView({ change, planVersion: plan.version }) : null,
    status: "ready",
  };
}

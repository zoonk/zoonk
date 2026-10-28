import "server-only";
import { isPlanReady } from "./_utils/apply-plan-change";
import { findOwnedPlan } from "./_utils/owned-plan";
import { computePlan } from "./_utils/replan";
import { type PlanBasesAdvice } from "./plan-bases-advice-contract";

export type PlanBasesAdviceResult =
  | { advice: PlanBasesAdvice; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/**
 * Plans the goal with every base in depth, so call it only when the learner asks, never for a page
 * or prefetch.
 */
export async function getPlanBasesAdvice(goalId: string): Promise<PlanBasesAdviceResult> {
  const owned = await findOwnedPlan({ goalId });

  if (owned.status !== "ready") {
    return owned;
  }

  const { context } = owned;

  if (context.phases.length === 0 || !isPlanReady(context)) {
    return { advice: { daysLeft: null, ready: false, recommended: null }, status: "ready" };
  }

  const computed = await computePlan({ context, mode: "forced", pace: "saved" });
  const { daysLeft, recommended } = computed.bases;

  return { advice: { daysLeft, ready: true, recommended }, status: "ready" };
}

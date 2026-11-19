import "server-only";
import { getGoalPlan } from "@zoonk/core/plans/get";
import { getSyllabusView } from "@zoonk/core/view-models/syllabus/get";
import { getPlanRevealToday } from "@zoonk/core/view-models/today/plan-reveal";
import { type RevealedPlan } from "@zoonk/learn/onboarding/actions";
import { toSyllabusOutline } from "@zoonk/learn/syllabus-section-view";

/** Null when the plan can't be read. */
export async function readRevealedPlan(goalId: string): Promise<RevealedPlan | null> {
  const [plan, today, syllabus] = await Promise.all([
    getGoalPlan(goalId),
    getPlanRevealToday(goalId),
    getSyllabusView({ goalId }),
  ]);

  if (plan.status !== "ready") {
    return null;
  }

  return {
    plan: plan.plan,
    reveal: today.status === "ready" ? today.reveal : null,
    syllabus: syllabus.status === "ready" ? toSyllabusOutline(syllabus.syllabus) : null,
  };
}

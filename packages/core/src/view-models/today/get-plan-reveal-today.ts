import "server-only";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { readStudyDay } from "../../sessions/_utils/read-study-day";
import { admitToday } from "./_utils/admit-today";
import { type PlanRevealDays, composeRevealDays } from "./_utils/compose-reveal";
import { readDaySession } from "./_utils/day-session";
import { type TodayViewResult } from "./get-today-view";

export type { PlanRevealDays } from "./_utils/compose-reveal";

export type PlanRevealTodayResult =
  | Exclude<TodayViewResult, { status: "ready" }>
  | { reveal: PlanRevealDays; status: "ready" };

/**
 * The plan reveal's Today and first week, read before the learner has seen their plan: the day
 * Today will show, and the six days after it composed with it so each lesson shows once. Like
 * Today's read, it never creates or settles the day.
 */
export async function getPlanRevealToday(
  goalId: string,
  timeZone?: string,
): Promise<PlanRevealTodayResult> {
  "use cache: private";

  const admission = await admitToday(goalId, { revealing: true });

  if (admission.status !== "admitted") {
    return admission;
  }

  const { goal, userId } = admission.owned;

  const [day, plan] = await Promise.all([
    readStudyDay({ goal, now: new Date(), timeZone, userId }),
    getGoalPlan(goalId),
  ]);

  if (!day) {
    return {
      goal: { id: goal.id, kind: goal.kind, title: goal.title },
      status: "preparing",
      userId,
    };
  }

  const { session } = await readDaySession(day);
  const days = plan.status === "ready" ? plan.nextDays : [];

  return {
    reveal: { ...composeRevealDays({ blocks: session.blocks, days }), today: session },
    status: "ready",
  };
}

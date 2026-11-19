import "server-only";
import { readStudyDay } from "../../sessions/_utils/read-study-day";
import { type DayView } from "../../sessions/day-view";
import { admitToday } from "./_utils/admit-today";
import { readDaySession } from "./_utils/day-session";
import { type TodayViewResult } from "./get-today-view";

export type PlanRevealDays = {
  /** The day Today will show. */
  today: DayView;
};

export type PlanRevealTodayResult =
  | Exclude<TodayViewResult, { status: "ready" }>
  | { reveal: PlanRevealDays; status: "ready" };

/**
 * The day Today will show, read before the learner has seen their plan, so the reveal's Start opens
 * its next step. Like Today's read, it never creates or settles the day.
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

  const day = await readStudyDay({ goal, now: new Date(), timeZone, userId });

  if (!day) {
    return {
      goal: { displayName: goal.displayName, id: goal.id, kind: goal.kind, title: goal.title },
      status: "preparing",
      userId,
    };
  }

  const { session } = await readDaySession(day);

  return { reveal: { today: session }, status: "ready" };
}

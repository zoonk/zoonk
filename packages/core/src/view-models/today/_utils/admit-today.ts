import { prisma } from "@zoonk/db";
import { findActiveGoalId } from "../../../goals/_utils/goal-view";
import { hasStudyGoal } from "../../../goals/_utils/study-goal";
import { getCurrentSuggestedGoal } from "../../../goals/suggestions/get-current-suggested-goal";
import { type OwnedGoal, findOwnedGoal } from "../../../learner/_utils/owned-goal";
import { getSession } from "../../../users/get-session";
import { isCourseSetupLeft } from "../../onboarding/onboarding-steps";
import { type TodayViewResult } from "../get-today-view";

/**
 * A goal's plan is built in the background after onboarding. Until it has items there's no day to
 * build, and building one then would fix an empty day in place: the day is built once it's ready.
 */
async function isPlanBuilt(goalId: string): Promise<boolean> {
  const items = await prisma.planItem.count({ where: { plan: { goalId } } });
  return items > 0;
}

/** Today's own refusal, or the learner's goal it shows a day for (`admitted`). */
export type TodayAdmission =
  | Exclude<TodayViewResult, { status: "ready" }>
  | { owned: Extract<OwnedGoal, { status: "ready" }>; status: "admitted" };

/**
 * Whether Today shows a day for the requested goal (the active one by default): the learner's own
 * active goal once its plan is built and, for a course start, its questions answered. It writes
 * nothing, so a refused goal stays as it was.
 */
export async function admitToday(requestedGoalId?: string): Promise<TodayAdmission> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const goalId = requestedGoalId ?? (await findActiveGoalId(userId));

  if (!goalId) {
    return { status: "noGoal", suggestedGoal: await getCurrentSuggestedGoal(), userId };
  }

  // Whether the plan is built is read alongside the goal; it's only used once the goal is theirs.
  const [owned, built] = await Promise.all([findOwnedGoal(goalId), isPlanBuilt(goalId)]);

  if (owned.status !== "ready") {
    return owned;
  }

  // A paused, completed or archived goal has no day to plan: nothing is built for it.
  if (owned.goal.status !== "active") {
    return { status: "goalNotActive", userId };
  }

  // A quick explanation is a one-off: a learner with only explanations has no day to plan.
  if (owned.goal.kind === "explain" && !(await hasStudyGoal(userId))) {
    return { status: "noGoal", suggestedGoal: await getCurrentSuggestedGoal(), userId };
  }

  const { id, kind, title } = owned.goal;

  // A course's default plan is ready before its questions are answered (see `isCourseSetupLeft`).
  if (!built || isCourseSetupLeft(owned.goal)) {
    return { goal: { id, kind, title }, status: "preparing", userId };
  }

  return { owned, status: "admitted" };
}

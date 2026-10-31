import { hasStudyGoal } from "../../../goals/_utils/study-goal";
import { getCurrentSuggestedGoal } from "../../../goals/suggestions/get-current-suggested-goal";
import { type OwnedGoal } from "../../../learner/_utils/owned-goal";
import { readActiveGoal, readLearningProfile } from "../../../learner/facts/learning-profile";
import { readSavedPlan } from "../../../learner/facts/saved-plan";
import { getOwnedGoal } from "../../../learner/get-owned-goal";
import { getSession } from "../../../users/get-session";
import { isCourseSetupLeft } from "../../onboarding/onboarding-steps";
import { type TodayViewResult } from "../get-today-view";

/** Do not persist an empty day before the background plan has items. */
async function isPlanBuilt({ goalId, userId }: { goalId: string; userId: string }) {
  const plan = await readSavedPlan(userId, goalId);
  return (plan?.items.length ?? 0) > 0;
}

async function findTodayGoalId(userId: string): Promise<string | null> {
  const active = await readActiveGoal(userId);

  if (active) {
    return active.id;
  }

  const profile = await readLearningProfile(userId);
  return profile?.activeGoalId ?? null;
}

export type TodayAdmission =
  | Exclude<TodayViewResult, { status: "ready" }>
  | { owned: Extract<OwnedGoal, { status: "ready" }>; status: "admitted" };

/** Read-only; admits only an owned active goal with a built plan and completed course setup. */
export async function admitToday(requestedGoalId?: string): Promise<TodayAdmission> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const goalId = requestedGoalId ?? (await findTodayGoalId(userId));

  if (!goalId) {
    return { status: "noGoal", suggestedGoal: await getCurrentSuggestedGoal(), userId };
  }

  // Whether the plan is built is read alongside the goal; it's only used once the goal is theirs.
  const [owned, built] = await Promise.all([getOwnedGoal(goalId), isPlanBuilt({ goalId, userId })]);

  if (owned.status !== "ready") {
    return owned;
  }

  if (owned.goal.status !== "active") {
    return { status: "goalNotActive", userId };
  }

  // A quick explanation alone is not a daily study plan.
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

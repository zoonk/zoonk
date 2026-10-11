import "server-only";
import { findActiveGoalId } from "../../goals/_utils/goal-view";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { getSession } from "../../users/get-session";
import { loadStudySessionView } from "../_utils/load-session-view";
import { resolveTodaySession } from "../_utils/today-session";
import { type TodayStudySessionInput } from "../contract";
import { type StudySessionResult } from "../get-study-session";

type TodayStudySessionResult = StudySessionResult | { status: "goalNotActive" };

/**
 * Today's session for a goal (the active goal by default), as tests open it: the learner's day is
 * built the way Today builds it (`resolveTodaySession`, which `getTodayView` calls), the first time
 * it's opened on the learner's local day, and returned in the session's shape. Opening it again
 * the same day returns the same session with its progress.
 */
export async function getTodayStudySession(
  input: TodayStudySessionInput,
): Promise<TodayStudySessionResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const goalId = input.goalId ?? (await findActiveGoalId(session.user.id));

  if (!goalId) {
    return { status: "notFound" };
  }

  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  // A paused, completed or archived goal has no day to plan: nothing is built for it.
  if (owned.goal.status !== "active") {
    return { status: "goalNotActive" };
  }

  const day = await resolveTodaySession({
    goal: owned.goal,
    timeZone: input.timeZone,
    userId: owned.userId,
  });

  return { session: await loadStudySessionView({ ...day, userId: owned.userId }), status: "ready" };
}

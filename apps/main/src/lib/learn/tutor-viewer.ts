import "server-only";
import { getActiveGoalId } from "@zoonk/core/goals/active-goal";
import { getSession } from "@zoonk/core/users/session";
import { getLearnerBuddy } from "./learner-buddy";

export async function getTutorViewer() {
  const [session, buddy] = await Promise.all([getSession(), getLearnerBuddy()]);
  const canAsk = Boolean(session && !session.user.isAnonymous);

  if (!canAsk) {
    return { buddy, canAsk, goalId: null };
  }

  const goalId = await getActiveGoalId();

  return { buddy, canAsk, goalId };
}

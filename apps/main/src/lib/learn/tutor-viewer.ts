import "server-only";
import { getActiveGoalId } from "@zoonk/core/goals/active-goal";
import { getSession } from "@zoonk/core/users/session";
import { getLearnerBuddy } from "./learner-buddy";

/**
 * Who asks the tutor on a screen, and the buddy who answers: signed-in learners ask, with their
 * buddy's face and name; visitors and guests see the sign-up prompt, with the default buddy until
 * they choose one. `goalId` is the goal whose plan the
 * buddy reads and changes from a chapter or a lesson: the active one, as core reads it.
 */
export async function getTutorViewer() {
  const [session, buddy] = await Promise.all([getSession(), getLearnerBuddy()]);
  const canAsk = Boolean(session && !session.user.isAnonymous);

  if (!canAsk) {
    return { buddy, canAsk, goalId: null };
  }

  const goalId = await getActiveGoalId();

  return { buddy, canAsk, goalId };
}

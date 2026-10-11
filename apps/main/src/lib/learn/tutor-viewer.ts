import "server-only";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { getSession } from "@zoonk/core/users/session";
import { getLearnerBuddy } from "./learner-buddy";

/**
 * Who asks the tutor on a screen, and the buddy who answers: signed-in learners ask, with their
 * buddy's face and name (null before they pick one); visitors and guests see the sign-up prompt,
 * a guest's still by the buddy they picked in onboarding. `goalId` is the goal whose plan the
 * buddy reads and changes from a chapter or a lesson: the active one, as core reads it.
 */
export async function getTutorViewer() {
  const session = await getSession();
  const canAsk = Boolean(session && !session.user.isAnonymous);

  if (!session) {
    return { buddy: null, canAsk, goalId: null };
  }

  const [buddy, goals] = await Promise.all([getLearnerBuddy(), listCurrentUserGoals()]);

  return { buddy, canAsk, goalId: canAsk ? (goals?.activeGoalId ?? null) : null };
}

import "server-only";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
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

  if (!session) {
    return { buddy, canAsk, goalId: null };
  }

  const goals = await listCurrentUserGoals();

  return { buddy, canAsk, goalId: canAsk ? (goals?.activeGoalId ?? null) : null };
}

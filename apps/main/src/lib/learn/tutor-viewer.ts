import "server-only";
import { getSession } from "@zoonk/core/users/session";
import { getLearnerBuddy } from "./learner-buddy";

/**
 * Who asks the tutor on a screen, and the buddy who answers: signed-in learners ask, with their
 * buddy's face and name (null before they pick one); visitors and guests see the sign-up prompt,
 * a guest's still by the buddy they picked in onboarding.
 */
export async function getTutorViewer() {
  const session = await getSession();
  const canAsk = Boolean(session && !session.user.isAnonymous);

  return { buddy: session ? await getLearnerBuddy() : null, canAsk };
}

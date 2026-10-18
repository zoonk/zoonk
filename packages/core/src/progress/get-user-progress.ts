import "server-only";
import { readUserProgress } from "../learner/facts/user-progress";
import { getProgressSession } from "./_utils/progress-cache";

/**
 * Returns the authenticated learner's canonical progress row without allowing
 * an app to choose which learner owns the protected read.
 */
export async function getUserProgress() {
  "use cache: private";

  const session = await getProgressSession();

  if (!session) {
    return null;
  }

  return readUserProgress(session.user.id);
}

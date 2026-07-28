import "server-only";
import { getProgressSession } from "./_utils/progress-cache";
import { getUserProgress as queryUserProgress } from "./progress-metrics";

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

  return queryUserProgress({ userId: session.user.id });
}

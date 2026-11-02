import "server-only";
import { readUserProgress } from "../learner/facts/user-progress";
import { getProgressSession } from "./_utils/progress-cache";

/** Uses the authenticated learner; null without a session or progress row. */
export async function getUserProgress() {
  "use cache: private";

  const session = await getProgressSession();

  if (!session) {
    return null;
  }

  return readUserProgress(session.user.id);
}

import "server-only";
import { readActiveGoal } from "../learner/facts/learning-profile";
import { getSession } from "../users/get-session";

export async function getActiveGoalId(): Promise<string | null> {
  "use cache: private";

  const session = await getSession();

  const goal = session ? await readActiveGoal(session.user.id) : null;

  return goal?.id ?? null;
}

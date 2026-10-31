import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../users/get-session";
import { type OwnedGoal } from "./_utils/owned-goal";
import { readOwnedGoal } from "./facts/owned-goal";

/** The GET ownership boundary; writers retain the uncached `findOwnedGoal` precondition. */
export async function getOwnedGoal(goalId: string): Promise<OwnedGoal> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const goal = isUuid(goalId) ? await readOwnedGoal(session.user.id, goalId) : null;

  return goal ? { goal, status: "ready", userId: session.user.id } : { status: "notFound" };
}

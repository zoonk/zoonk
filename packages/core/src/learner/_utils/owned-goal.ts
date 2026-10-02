import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { getSession } from "../../users/get-session";

export type OwnedGoal =
  | { goal: Goal; status: "ready"; userId: string }
  | { status: "notFound" }
  | { status: "unauthorized" };

/**
 * Resolves a goal for the signed-in learner. Another learner's goal is "not found", so goal ids
 * never reveal whether a goal exists.
 */
export async function findOwnedGoal(goalId: string): Promise<OwnedGoal> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId: session.user.id } });

  if (!goal) {
    return { status: "notFound" };
  }

  return { goal, status: "ready", userId: session.user.id };
}

const DEFAULT_TIME_ZONE = "UTC";

/** The timezone answers are dated in: the request's, then the goal's, then UTC. */
export function getAnswerTimeZone({
  goal,
  timeZone,
}: {
  goal: Pick<Goal, "timezone"> | null;
  timeZone?: string | null;
}): string {
  return (
    [timeZone, goal?.timezone].find((zone) => zone && isValidTimeZone(zone)) ?? DEFAULT_TIME_ZONE
  );
}

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

/**
 * The zone the learner's day is in, for every read and write of it (Today, the session, answers,
 * progress, the plan): the goal's stored zone, the request's only for a goal without one, then
 * UTC. A learner who moves takes their new zone at the start of a day (`moveGoalTimeZone`), so a
 * screen and the actions on it never read different days.
 */
export function getAnswerTimeZone({
  goal,
  timeZone,
}: {
  goal: Pick<Goal, "timezone"> | null;
  timeZone?: string | null;
}): string {
  return (
    [goal?.timezone, timeZone].find((zone) => zone && isValidTimeZone(zone)) ?? DEFAULT_TIME_ZONE
  );
}

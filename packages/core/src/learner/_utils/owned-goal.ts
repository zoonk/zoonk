import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { getSession } from "../../users/get-session";

export type OwnedGoal =
  | { goal: Goal; status: "ready"; userId: string }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** Requires a session; another learner's goal returns notFound to hide its existence. */
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

/** Uses the stored goal zone, falling back to the request and then UTC only when no zone is stored. */
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

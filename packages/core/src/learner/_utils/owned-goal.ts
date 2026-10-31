import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../../users/get-session";

export type OwnedGoal =
  | { goal: Goal; status: "ready"; userId: string }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** Internal: `userId` must come from a session or a learner's own write, never from a client. */
export async function findGoalFor({
  goalId,
  userId,
}: {
  goalId: string;
  userId: string;
}): Promise<Exclude<OwnedGoal, { status: "unauthorized" }>> {
  const goal = isUuid(goalId)
    ? await prisma.goal.findFirst({ where: { id: goalId, userId } })
    : null;

  return goal ? { goal, status: "ready", userId } : { status: "notFound" };
}

/** Requires a session; another learner's goal returns notFound to hide its existence. */
export async function findOwnedGoal(goalId: string): Promise<OwnedGoal> {
  const session = await getSession();
  return session ? findGoalFor({ goalId, userId: session.user.id }) : { status: "unauthorized" };
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

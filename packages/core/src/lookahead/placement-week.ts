import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isPlacementWeek } from "../sessions/_utils/session-placement";

/**
 * Whether a goal is in placement's first week (`isPlacementWeek`), when the first week's sessions
 * ask placement's questions: getting a session ready then also writes the questions of the plan's
 * picks that have none, such as the subjects a notice added after day 1's placement.
 *
 * This is a workflow bridge: the goal id comes from the access the request checked.
 */
export async function isGoalInPlacementWeek({
  goalId,
  now = new Date(),
  timeZone,
}: {
  goalId: string;
  now?: Date;
  timeZone: string;
}): Promise<boolean> {
  const goal = await prisma.goal.findUnique({
    select: { createdAt: true, details: true },
    where: { id: goalId },
  });

  return goal
    ? isPlacementWeek({ goal, localDate: getDateInTimeZone({ date: now, timeZone }), timeZone })
    : false;
}

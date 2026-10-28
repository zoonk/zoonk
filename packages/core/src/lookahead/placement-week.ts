import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isPlacementWeek } from "../sessions/_utils/session-placement";

/** Workflow bridge: goalId must come from the request's authorized goal access. */
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

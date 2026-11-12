import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { readSessionQuestions } from "../learner/placement/focus-test-summary";
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
    select: { createdAt: true, details: true, kind: true },
    where: { id: goalId },
  });

  if (!goal) {
    return false;
  }

  const day = { goal, localDate: getDateInTimeZone({ date: now, timeZone }), timeZone };

  if (goal.kind !== "exam") {
    return isPlacementWeek(day);
  }

  // An exam goal's sessions ask while its Focus test has subjects left, whatever the week; a day
  // the learner skipped still has tomorrow's questions to write.
  const asks = readSessionQuestions(day);
  return asks === "on" || asks === "skippedToday";
}

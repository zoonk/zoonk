import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isEstimatedGoalDate } from "./exam-calendar";

/**
 * Whether an exam goal's date is an estimate (the likely day of an edition whose notice isn't
 * out yet, or the start of the month the learner named before any notice gives the day), read
 * from its stored notice, so every screen that shows the date says so.
 */
export async function loadIsEstimatedGoalDate(
  goal: Pick<
    Goal,
    "createdAt" | "details" | "examBlueprintId" | "kind" | "targetDate" | "timezone"
  >,
): Promise<boolean> {
  if (goal.kind !== "exam" || !goal.targetDate) {
    return false;
  }

  const blueprint = goal.examBlueprintId
    ? await prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
    : null;

  return isEstimatedGoalDate({ blueprint, goal });
}

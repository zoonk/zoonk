import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type GoalDateKind, getGoalDateKind } from "./exam-calendar";

/**
 * How an exam goal's date is known (see `GoalDateKind`): an estimate, or the month the learner
 * named, read from its stored notice, so every screen that shows the date says so.
 */
export async function loadGoalDateKind(
  goal: Pick<
    Goal,
    "createdAt" | "details" | "examBlueprintId" | "kind" | "targetDate" | "timezone"
  >,
): Promise<GoalDateKind> {
  if (goal.kind !== "exam" || !goal.targetDate) {
    return { estimated: false, namedMonth: false };
  }

  const blueprint = goal.examBlueprintId
    ? await prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
    : null;

  return getGoalDateKind({ blueprint, goal });
}

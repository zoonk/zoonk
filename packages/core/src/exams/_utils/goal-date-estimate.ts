import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { type GoalDateKind, getGoalDateKind } from "./exam-calendar";

export async function loadGoalDateKind(
  goal: Pick<
    Goal,
    "createdAt" | "details" | "examBlueprintId" | "kind" | "targetDate" | "timezone"
  >,
  knownBlueprint?: ExamBlueprint | null,
): Promise<GoalDateKind> {
  if (goal.kind !== "exam" || !goal.targetDate) {
    return { estimated: false, namedMonth: false };
  }

  const blueprint =
    knownBlueprint === undefined && goal.examBlueprintId
      ? await prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
      : (knownBlueprint ?? null);

  return getGoalDateKind({ blueprint, goal });
}

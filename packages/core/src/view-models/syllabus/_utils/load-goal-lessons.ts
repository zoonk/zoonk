import "server-only";
import { prisma } from "@zoonk/db";
import { type PlanReadContext } from "../../../plans/_utils/plan-read-projection";
import { type SyllabusView } from "../syllabus-contract";
import { buildSyllabus } from "./build-syllabus";
import { loadSyllabusInput } from "./load-syllabus";

/**
 * A goal's lessons studied or known of its plan's, as its syllabus adds them up, for a goal
 * measured in lessons; null for an exam (measured by preparation), a quick explanation or a goal
 * without a plan. The caller has checked the goal is the learner's.
 */
export async function loadGoalLessons(
  goalId: string,
  selectedPlan?: Pick<PlanReadContext, "items" | "state">,
): Promise<SyllabusView["lessons"] | null> {
  const goal = await prisma.goal.findUnique({
    select: {
      createdAt: true,
      details: true,
      examBlueprintId: true,
      id: true,
      kind: true,
      language: true,
      primaryCourseId: true,
      targetDate: true,
      userId: true,
    },
    where: { id: goalId },
  });

  if (!goal || goal.kind === "exam" || goal.kind === "explain") {
    return null;
  }

  const input = await loadSyllabusInput(goal, { selectedPlan });
  return input ? buildSyllabus(input).lessons : null;
}

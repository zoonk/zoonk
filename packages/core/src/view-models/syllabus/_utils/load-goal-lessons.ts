import "server-only";
import { prisma } from "@zoonk/db";
import { type SyllabusView } from "../syllabus-contract";
import { buildSyllabus } from "./build-syllabus";
import { loadSyllabusInput } from "./load-syllabus";

/**
 * A goal's lessons studied or known of its plan's, as its syllabus adds them up, for a goal
 * measured in lessons; null for an exam (measured by preparation), a quick explanation or a goal
 * without a plan. The caller has checked the goal is the learner's.
 */
export async function loadGoalLessons(goalId: string): Promise<SyllabusView["lessons"] | null> {
  const goal = await prisma.goal.findUnique({
    select: {
      createdAt: true,
      details: true,
      examBlueprintId: true,
      id: true,
      kind: true,
      language: true,
      targetDate: true,
      userId: true,
    },
    where: { id: goalId },
  });

  if (!goal || goal.kind === "exam" || goal.kind === "explain") {
    return null;
  }

  const input = await loadSyllabusInput(goal);
  return input ? buildSyllabus(input).lessons : null;
}

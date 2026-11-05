import "server-only";
import { prisma } from "@zoonk/db";
import { type SyllabusView } from "../syllabus-contract";
import { buildSyllabus } from "./build-syllabus";
import { loadSyllabusInput } from "./load-syllabus";

/** Caller must verify goal ownership; returns null for exams, explanations, or missing plans. */
export async function loadGoalLessons(goalId: string): Promise<SyllabusView["lessons"] | null> {
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

  const input = await loadSyllabusInput(goal);
  return input ? buildSyllabus(input).lessons : null;
}

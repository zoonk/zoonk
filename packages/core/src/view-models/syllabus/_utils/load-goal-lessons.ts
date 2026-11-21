import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type SyllabusView } from "../syllabus-contract";
import { buildSyllabus } from "./build-syllabus";
import { loadSyllabusInput } from "./load-syllabus";
import { readSyllabusInput } from "./read-syllabus-input";

function hasLessonShare(goal: Pick<Goal, "kind">): boolean {
  return goal.kind !== "exam" && goal.kind !== "explain";
}

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

  if (!goal || !hasLessonShare(goal)) {
    return null;
  }

  const input = await loadSyllabusInput(goal);
  return input ? buildSyllabus(input).lessons : null;
}

/** GET-only, after ownership authorization; writes call `loadGoalLessons` for fresh reads. */
export async function readGoalLessons({
  goal,
  userId,
}: {
  goal: Pick<Goal, "id" | "kind">;
  userId: string;
}): Promise<SyllabusView["lessons"] | null> {
  if (!hasLessonShare(goal)) {
    return null;
  }

  const input = await readSyllabusInput(userId, goal.id);
  return input ? buildSyllabus(input).lessons : null;
}

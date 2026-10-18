import "server-only";
import { prisma } from "@zoonk/db";
import { type CandidateExam, toCandidateExam } from "../../exams/candidate-exams";
import { lessonGoalsFilter } from "../../sources/goal-material";

/** A few exams are enough to set a lesson's depth and its questions' style. */
const MAX_LESSON_EXAMS = 3;

/**
 * The exams the learners who study a shared lesson prepare for: the public notices of the exam
 * goals that plan the lesson, its chapter or its course. A shared lesson is written once, so it's
 * written for the candidates of those exams (at their depth, in their questions' style) without
 * naming any of them; a lesson no exam goal needs gets none and is written for everyone.
 *
 * This is a workflow bridge: the lesson comes from the workflow planning or writing it.
 */
export async function loadLessonExams(input: {
  chapterId: string | null;
  courseId: string | null;
  lessonId: string;
}): Promise<CandidateExam[]> {
  const blueprints = await prisma.examBlueprint.findMany({
    orderBy: { updatedAt: "desc" },
    take: MAX_LESSON_EXAMS,
    where: { goals: { some: { kind: "exam", ...lessonGoalsFilter(input) } }, ownerId: null },
  });

  return blueprints.map((blueprint) => toCandidateExam(blueprint));
}

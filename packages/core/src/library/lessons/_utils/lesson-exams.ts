import "server-only";
import { prisma } from "@zoonk/db";
import { type CandidateExam, toCandidateExam } from "../../exams/candidate-exams";
import { readBlueprintContent } from "../../exams/save-exam-blueprint";
import { asksWrittenAnswers, readGoalExamFormats } from "../../exams/written-answers";
import { lessonGoalsFilter } from "../../sources/goal-material";

/** A few exams are enough to set a lesson's depth and its questions' style. */
const MAX_LESSON_EXAMS = 3;

type LessonGoalsOf = Parameters<typeof lessonGoalsFilter>[0];

/**
 * The exams the learners who study a shared lesson prepare for: the public notices of the exam
 * goals that plan the lesson, its chapter or its course. A shared lesson is written once, so it's
 * written for the candidates of those exams (at their depth, in their questions' style) without
 * naming any of them; a lesson no exam goal needs gets none and is written for everyone.
 *
 * This is a workflow bridge: the lesson comes from the workflow planning or writing it.
 */
export async function loadLessonExams(input: LessonGoalsOf): Promise<CandidateExam[]> {
  const blueprints = await prisma.examBlueprint.findMany({
    orderBy: { updatedAt: "desc" },
    take: MAX_LESSON_EXAMS,
    where: { goals: { some: { kind: "exam", ...lessonGoalsFilter(input) } }, ownerId: null },
  });

  return blueprints.map((blueprint) => toCandidateExam(blueprint));
}

/**
 * Whether the exam of any goal that plans the lesson, its chapter or its course asks written
 * answers (`asksWrittenAnswers`), so the lesson may ask its learners to write: a public notice's,
 * a class test's read from the learner's material (whose lesson gets no `EXAMS`), or, before its
 * blueprint is linked, the formats a first pass over the notice read. Every other lesson asks only
 * what learners pick.
 *
 * This is a workflow bridge: the lesson comes from the workflow planning or writing it.
 */
export async function loadLessonWrittenAnswers(input: LessonGoalsOf): Promise<boolean> {
  const goals = lessonGoalsFilter(input);

  const [blueprints, noticeGoals] = await Promise.all([
    prisma.examBlueprint.findMany({ where: { goals: { some: goals } } }),
    prisma.goal.findMany({
      select: { details: true, kind: true },
      where: { ...goals, examBlueprintId: null, kind: "exam" },
    }),
  ]);

  return [
    ...blueprints.map((blueprint) => readBlueprintContent(blueprint).structure),
    ...noticeGoals.map((goal) => readGoalExamFormats({ goal, structure: null })),
  ].some((formats) => asksWrittenAnswers(formats));
}

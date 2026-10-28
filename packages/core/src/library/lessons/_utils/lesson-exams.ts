import "server-only";
import { prisma } from "@zoonk/db";
import { type CandidateExam, toCandidateExam } from "../../exams/candidate-exams";
import { readBlueprintContent } from "../../exams/save-exam-blueprint";
import { asksShortAnswers, readGoalExamFormats } from "../../exams/short-answers";
import { lessonGoalsFilter } from "../../sources/goal-material";

const MAX_LESSON_EXAMS = 3;

type LessonGoalsOf = Parameters<typeof lessonGoalsFilter>[0];

/** Internal workflow bridge: the lesson must come from the workflow planning or writing it. */
export async function loadLessonExams(input: LessonGoalsOf): Promise<CandidateExam[]> {
  const blueprints = await prisma.examBlueprint.findMany({
    orderBy: { updatedAt: "desc" },
    take: MAX_LESSON_EXAMS,
    where: { goals: { some: { kind: "exam", ...lessonGoalsFilter(input) } }, ownerId: null },
  });

  return blueprints.map((blueprint) => toCandidateExam(blueprint));
}

/** Internal workflow bridge: the lesson must come from the workflow planning or writing it. */
export async function loadLessonShortAnswers(input: LessonGoalsOf): Promise<boolean> {
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
  ].some((formats) => asksShortAnswers(formats));
}

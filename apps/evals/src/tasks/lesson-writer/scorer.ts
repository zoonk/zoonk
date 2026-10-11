import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/v2/lesson-writer";
import { type WrittenLesson } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { checkWrittenLesson } from "@zoonk/core/library/quality/code-checks";
import { checkLessonPrograms } from "@zoonk/core/library/quality/program-checks";
import { findEmDashes } from "@zoonk/utils/text-flaws";
import { LESSON_WRITER_SCORE_CATEGORIES } from "./score-categories";

/**
 * Em dashes the writer used, which production takes out of every screen before storing it
 * (`replaceEmDashes`), so the lesson reads with commas where the writer meant a dash.
 */
function findLessonEmDashes(lesson: WrittenLesson): { problem: string; screen: number | null }[] {
  return [
    ...lesson.screens.flatMap((screen, index) =>
      findEmDashes(screen).map((problem) => ({ problem, screen: index })),
    ),
    ...findEmDashes(lesson.summary).map((problem) => ({ problem, screen: null })),
  ];
}

/**
 * Runs the code half of the quality gate production runs, including running
 * the code in code activities, and finds the em dashes production rewrites:
 * each screen is one part, plus the summary card.
 * The judge sees the whole lesson, since a lesson is only published whole, and
 * the pass rate is scored on its own.
 */
async function checkLesson(
  output: string,
  input: WriteLessonDraftParams,
): Promise<CodeCheckResult> {
  const lesson = JSON.parse(output) as WrittenLesson;

  const result = checkWrittenLesson({
    chapterLessons: input.chapterLessons,
    language: input.language,
    lesson,
    level: input.level,
    material: input.material,
    sources: input.sources,
    spec: input.spec,
  });

  const problems = [
    ...result.problems,
    ...(await checkLessonPrograms(result.screens)),
    ...findLessonEmDashes(lesson),
  ];

  const failingScreens = new Set(problems.map((problem) => problem.screen ?? -1));
  const total = input.spec.screens.length + 1;

  return {
    judgedOutput: output,
    passed: total - failingScreens.size,
    problems: problems.map((problem) =>
      problem.screen === null
        ? `Lesson: ${problem.problem}`
        : `Screen ${problem.screen + 1}: ${problem.problem}`,
    ),
    total,
  };
}

export const scoreLessonWriter: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkLesson(value, testCase.userInput as WriteLessonDraftParams),
    output,
    scoreCategories: LESSON_WRITER_SCORE_CATEGORIES,
    testCase,
  });

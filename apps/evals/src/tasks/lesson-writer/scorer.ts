import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/v2/lesson-writer";
import { type WrittenLesson } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { checkWrittenLesson } from "@zoonk/core/library/quality/code-checks";
import { checkLessonPrograms } from "@zoonk/core/library/quality/program-checks";
import { findQuestionBases } from "@zoonk/core/library/steps/question-bases";
import { findNumberFormatFlaws } from "@zoonk/utils/number-format-flaws";
import { findEmDashes } from "@zoonk/utils/text-flaws";
import { LESSON_WRITER_SCORE_CATEGORIES } from "./score-categories";

/** What `find` reports on each screen, and on the summary card as the lesson's own. */
function findInLesson({
  find,
  lesson,
}: {
  find: (value: unknown) => string[];
  lesson: WrittenLesson;
}): { problem: string; screen: number | null }[] {
  return [
    ...lesson.screens.flatMap((screen, index) =>
      find(screen).map((problem) => ({ problem, screen: index })),
    ),
    ...find(lesson.summary).map((problem) => ({ problem, screen: null })),
  ];
}

/**
 * Runs the code half of the quality gate production runs, including running
 * the code in code activities, finds the em dashes production rewrites, numbers
 * written the way the lesson's language doesn't (`findNumberFormatFlaws`) and the
 * question bases whose quote isn't on the screen they name, which production
 * leaves out (`findQuestionBases`): each screen is one part, plus the summary card.
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
    writtenAnswers: input.writtenAnswers,
  });

  const problems = [
    ...result.problems,
    ...(await checkLessonPrograms(result.screens)),
    ...findInLesson({ find: findEmDashes, lesson }),
    ...findInLesson({
      find: (value) => findNumberFormatFlaws({ language: input.language, value }),
      lesson,
    }),
    ...findQuestionBases({ lesson, screens: result.screens }).problems,
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

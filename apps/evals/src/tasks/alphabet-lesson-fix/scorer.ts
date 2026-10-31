import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import {
  type PublishedAlphabetLesson,
  listAlphabetScreens,
  pickWholeLesson,
} from "@zoonk/ai/tasks/language/alphabet-lesson";
import { checkAlphabetFix } from "@zoonk/core/library/language/alphabet-lesson-validator";
import { ALPHABET_LESSON_FIX_SCORE_CATEGORIES } from "./score-categories";
import { type AlphabetLessonFixInput } from "./test-cases";

function listFixedParts({
  fixed,
  input,
}: {
  fixed: PublishedAlphabetLesson;
  input: AlphabetLessonFixInput;
}) {
  const screens = listAlphabetScreens(fixed);

  return input.problems.map(({ screen }) =>
    screen === null ? { wholeLesson: pickWholeLesson(fixed) } : { screen, ...screens[screen] },
  );
}

function checkFix({
  input,
  output,
}: {
  input: AlphabetLessonFixInput;
  output: string;
}): CodeCheckResult {
  const fixed = JSON.parse(output) as PublishedAlphabetLesson;

  const checks = checkAlphabetFix({
    fixed,
    lesson: input.lesson,
    problems: input.problems,
    targetLanguage: input.targetLanguage,
  });

  return {
    judgedOutput: JSON.stringify(listFixedParts({ fixed, input }), null, 2),
    passed: checks.filter((check) => check.passed).length,
    problems: checks.flatMap((check) => (check.passed ? [] : [check.problem])),
    total: checks.length,
  };
}

export const scoreAlphabetLessonFix: TaskScorer = ({ output, testCase }) => {
  const input = testCase.userInput as AlphabetLessonFixInput;

  return scoreWithCodeChecks({
    check: (text) => checkFix({ input, output: text }),
    output,
    scoreCategories: ALPHABET_LESSON_FIX_SCORE_CATEGORIES,
    testCase,
  });
};

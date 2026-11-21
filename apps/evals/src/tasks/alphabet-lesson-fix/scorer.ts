import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import {
  type PublishedAlphabetLesson,
  listAlphabetScreens,
  pickWholeLesson,
} from "@zoonk/ai/tasks/language/alphabet-lesson";
import { checkAlphabetFix } from "@zoonk/core/library/language/alphabet-lesson-validator";
import { alphabetAnswerKeys } from "../alphabet-lesson/answer-keys";
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

  const problems = checks.flatMap((check) => (check.passed ? [] : [check.problem]));

  return {
    blockingProblems: problems,
    criteria: ["fixed"],
    judgedOutput: JSON.stringify(listFixedParts({ fixed, input }), null, 2),
    ...alphabetAnswerKeys({ lesson: fixed }),
    passed: checks.filter((check) => check.passed).length,
    problems,
    total: checks.length,
  };
}

export const checkAlphabetLessonFixOutput: TaskCodeChecks = ({ output, testCase }) =>
  checkFix({ input: testCase.userInput as AlphabetLessonFixInput, output });

export const scoreAlphabetLessonFix: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkAlphabetLessonFixOutput({ output: value, testCase }),
    output,
    scoreCategories: ALPHABET_LESSON_FIX_SCORE_CATEGORIES,
    testCase,
  });

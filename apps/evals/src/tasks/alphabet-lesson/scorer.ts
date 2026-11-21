import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import {
  type AlphabetLessonContent,
  type GenerateAlphabetLessonParams,
} from "@zoonk/ai/tasks/language/alphabet-lesson";
import { buildAlphabetLessonSteps } from "@zoonk/core/library/language/alphabet-lesson-steps";
import { checkAlphabetLesson } from "@zoonk/core/library/language/alphabet-lesson-validator";
import { ALPHABET_LESSON_SCORE_CATEGORIES } from "./score-categories";

function checkLesson({
  output,
  targetLanguage,
}: {
  output: string;
  targetLanguage: string;
}): CodeCheckResult {
  const lesson = JSON.parse(output) as AlphabetLessonContent;
  const checks = checkAlphabetLesson({ lesson, targetLanguage });
  const steps = buildAlphabetLessonSteps({ audioUrls: new Map(), content: lesson });

  return {
    blockingProblems: steps.some((step) => step.kind === "alphabet")
      ? []
      : ["The lesson did not contain any usable alphabet symbols."],
    criteria: ["accuracy"],
    judgedOutput: output,
    passed: checks.filter((check) => check.passed).length,
    problems: checks.flatMap((check) => (check.passed ? [] : [check.problem])),
    total: checks.length,
  };
}

export const checkAlphabetLessonOutput: TaskCodeChecks = ({ output, testCase }) => {
  const { targetLanguage } = testCase.userInput as GenerateAlphabetLessonParams;

  return checkLesson({ output, targetLanguage });
};

export const scoreAlphabetLesson: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkAlphabetLessonOutput({ output: value, testCase }),
    output,
    scoreCategories: ALPHABET_LESSON_SCORE_CATEGORIES,
    testCase,
  });

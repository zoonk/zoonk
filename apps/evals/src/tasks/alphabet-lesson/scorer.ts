import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import {
  type AlphabetLessonContent,
  type GenerateAlphabetLessonParams,
} from "@zoonk/ai/tasks/language/alphabet-lesson";
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

  return {
    judgedOutput: output,
    passed: checks.filter((check) => check.passed).length,
    problems: checks.flatMap((check) => (check.passed ? [] : [check.problem])),
    total: checks.length,
  };
}

export const scoreAlphabetLesson: TaskScorer = ({ output, testCase }) => {
  const { targetLanguage } = testCase.userInput as GenerateAlphabetLessonParams;

  return scoreWithCodeChecks({
    check: (text) => checkLesson({ output: text, targetLanguage }),
    output,
    scoreCategories: ALPHABET_LESSON_SCORE_CATEGORIES,
    testCase,
  });
};

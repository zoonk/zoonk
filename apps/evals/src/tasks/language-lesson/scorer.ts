import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { generateScore } from "@/lib/score";
import { type TaskScorer, getJudgeExpectations } from "@/lib/types";
import { type LanguageLessonContent } from "@zoonk/ai/tasks/v2/language/language-lesson";
import { definitionNamesWord } from "@zoonk/ai/tasks/v2/language/language-lesson-rules";
import { isSameLanguage } from "@zoonk/utils/languages";
import { LANGUAGE_LESSON_SCORE_CATEGORIES } from "./score-categories";
import { type LanguageLessonInput } from "./test-cases";

function parseLesson(output: string): LanguageLessonContent | null {
  try {
    return JSON.parse(output) as LanguageLessonContent;
  } catch {
    return null;
  }
}

/**
 * A lesson in the learner's own language defines its words: the pipeline drops a word whose
 * definition names it (`definitionNamesWord`), so the judge reads the lesson without it.
 */
function checkDefinitions(output: string): CodeCheckResult {
  const lesson = parseLesson(output);

  if (!lesson) {
    return { judgedOutput: output, passed: 0, problems: ["The output isn't a lesson."], total: 1 };
  }

  const named = lesson.words.filter((word) =>
    definitionNamesWord({ definition: word.translation, word: word.word }),
  );

  const kept = lesson.words.filter((word) => !named.includes(word));

  return {
    judgedOutput: JSON.stringify({ ...lesson, words: kept }),
    passed: kept.length,
    problems: named.map((word) => `"${word.word}" is defined as "${word.translation}".`),
    total: lesson.words.length,
  };
}

/**
 * The judge scores every lesson against its rubric; one in the learner's own language also gets
 * the pipeline's check that no word is defined by itself.
 */
export const scoreLanguageLesson: TaskScorer = ({ output, testCase }) => {
  const input = testCase.userInput as LanguageLessonInput;

  if (isSameLanguage(input)) {
    return scoreWithCodeChecks({
      check: checkDefinitions,
      output,
      scoreCategories: LANGUAGE_LESSON_SCORE_CATEGORIES,
      testCase,
    });
  }

  return generateScore({
    expectations: getJudgeExpectations(testCase),
    output,
    prompt: JSON.stringify(testCase.userInput, null, 2),
    scoreCategories: LANGUAGE_LESSON_SCORE_CATEGORIES,
  });
};

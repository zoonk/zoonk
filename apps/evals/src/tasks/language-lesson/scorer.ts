import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { generateScore } from "@/lib/score";
import { type TaskCodeChecks, type TaskScorer, getJudgeExpectations } from "@/lib/types";
import { type LanguageLessonContent } from "@zoonk/ai/tasks/language/language-lesson";
import { definitionNamesWord } from "@zoonk/ai/tasks/language/language-lesson-rules";
import { cleanWrittenLanguageLesson } from "@zoonk/core/library/language/write-lesson-content";
import { isSameLanguage } from "@zoonk/utils/languages";
import { LANGUAGE_LESSON_SCORE_CATEGORIES } from "./score-categories";
import { type LanguageLessonInput } from "./test-cases";

export function parseLesson(output: string): LanguageLessonContent | null {
  try {
    return JSON.parse(output) as LanguageLessonContent;
  } catch {
    return null;
  }
}

function checkDefinitions({
  input,
  output,
}: {
  input: LanguageLessonInput;
  output: string;
}): CodeCheckResult {
  const lesson = parseLesson(output);

  if (!lesson) {
    const problems = ["The output isn't a lesson."];
    return { blockingProblems: problems, judgedOutput: output, passed: 0, problems, total: 1 };
  }

  const named = lesson.words.filter((word) =>
    definitionNamesWord({ definition: word.translation, word: word.word }),
  );

  const kept = lesson.words.filter((word) => !named.includes(word));

  const cleaned =
    named.length > 0
      ? cleanWrittenLanguageLesson({
          content: lesson,
          inputs: {
            learnerLanguage: input.learnerLanguage,
            skillId: null,
            targetLanguage: input.targetLanguage,
            writerInput: input,
          },
        })
      : undefined;

  return {
    blockingProblems:
      cleaned === null ? ["The lesson could not supply enough usable language exercises."] : [],
    criteria: ["pairAwareness"],
    judgedOutput: JSON.stringify({ ...lesson, words: kept }),
    passed: kept.length,
    problems: named.map((word) => `"${word.word}" is defined as "${word.translation}".`),
    total: lesson.words.length,
  };
}

export const checkLanguageLessonOutput: TaskCodeChecks = ({ output, testCase }) => {
  const input = testCase.userInput as LanguageLessonInput;

  return isSameLanguage(input)
    ? checkDefinitions({ input, output })
    : { judgedOutput: output, passed: 0, problems: [], total: 0 };
};

export const scoreLanguageLesson: TaskScorer = ({ output, testCase }) => {
  const input = testCase.userInput as LanguageLessonInput;

  if (isSameLanguage(input)) {
    return scoreWithCodeChecks({
      check: (value) => checkLanguageLessonOutput({ output: value, testCase }),
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

import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import { type AlphabetLessonContent } from "@zoonk/ai/tasks/v2/language/alphabet-lesson";
import { ALPHABET_LESSON_SCORE_CATEGORIES } from "./score-categories";
import { type AlphabetLessonExpected } from "./test-cases";

const LATIN_LETTER = /\p{Script=Latin}/u;
const MAX_FORMS = 4;

/**
 * Five parts: every symbol is unique and outside the Latin script, every letter has a
 * romanization in Latin letters and something for the voice to say, and forms appear only in a
 * connected script (at most four per letter) and in every letter of one.
 */
function checkAlphabetLesson({
  expected,
  output,
}: {
  expected: AlphabetLessonExpected;
  output: string;
}): CodeCheckResult {
  const lesson = JSON.parse(output) as AlphabetLessonContent;
  const symbols = lesson.letters.map((letter) => letter.symbol.trim());

  const checks = [
    {
      passed: new Set(symbols).size === symbols.length,
      problem: "Two letters have the same symbol.",
    },
    {
      passed: symbols.every((symbol) => symbol && !LATIN_LETTER.test(symbol)),
      problem: "A symbol is empty or written in Latin letters.",
    },
    {
      passed: lesson.letters.every(
        (letter) => LATIN_LETTER.test(letter.readingAid) && letter.audioText.trim().length > 0,
      ),
      problem: "A letter lacks a Latin romanization or the text its audio says.",
    },
    {
      passed: lesson.letters.every((letter) => letter.forms.length <= MAX_FORMS),
      problem: `A letter has more than ${MAX_FORMS} forms.`,
    },
    {
      passed: expected.joined
        ? lesson.letters.some((letter) => letter.forms.length > 0)
        : lesson.letters.every((letter) => letter.forms.length === 0),
      problem: expected.joined
        ? "A connected script's letters have no joining forms."
        : "Letters of a script that doesn't join have forms.",
    },
  ];

  return {
    judgedOutput: output,
    passed: checks.filter((check) => check.passed).length,
    problems: checks.filter((check) => !check.passed).map((check) => check.problem),
    total: checks.length,
  };
}

export const scoreAlphabetLesson: TaskScorer<AlphabetLessonExpected> = ({ output, testCase }) => {
  const expected = testCase.expected;

  if (!expected) {
    throw new Error(`Alphabet lesson case ${testCase.id} needs its expected script kind.`);
  }

  return scoreWithCodeChecks({
    check: (text) => checkAlphabetLesson({ expected, output: text }),
    output,
    scoreCategories: ALPHABET_LESSON_SCORE_CATEGORIES,
    testCase,
  });
};

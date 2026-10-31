import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import {
  type PublishedAlphabetLesson,
  listAlphabetScreens,
} from "@zoonk/ai/tasks/language/alphabet-lesson";
import { ALPHABET_LESSON_FIX_SCORE_CATEGORIES } from "./score-categories";
import { type AlphabetLessonFixInput } from "./test-cases";

function comparable(text: string): string {
  return text.trim().normalize("NFC").toLowerCase();
}

function checkAlphabetFix({
  input,
  output,
}: {
  input: AlphabetLessonFixInput;
  output: string;
}): CodeCheckResult {
  const fixed = JSON.parse(output) as PublishedAlphabetLesson;
  const before = listAlphabetScreens(input.lesson);
  const after = listAlphabetScreens(fixed);

  const pairs = input.problems.flatMap(({ screen }) => {
    const original = screen === null ? undefined : before[screen];
    const card = screen === null ? undefined : after[screen];

    return screen !== null && original?.kind === "alphabet" && card?.kind === "alphabet"
      ? [{ card: card.content, original: original.content, screen: screen + 1 }]
      : [];
  });

  const checks = [
    {
      passed: pairs.length === input.problems.length,
      problem: "A problem names a screen that isn't a letter card.",
    },
    ...pairs.flatMap(({ card, original, screen }) => [
      {
        passed: card.pronunciation !== original.pronunciation,
        problem: `Screen ${screen}'s cue wasn't rewritten.`,
      },
      { passed: card.symbol === original.symbol, problem: `Screen ${screen} changed its letter.` },
      {
        passed:
          comparable(card.audioText) === comparable(card.symbol) ||
          comparable(card.pronunciation).includes(comparable(card.audioText)),
        problem: `Screen ${screen} plays a syllable its cue never shows.`,
      },
    ]),
  ];

  return {
    judgedOutput: JSON.stringify(
      pairs.map(({ card }) => card),
      null,
      2,
    ),
    passed: checks.filter((check) => check.passed).length,
    problems: checks.filter((check) => !check.passed).map((check) => check.problem),
    total: checks.length,
  };
}

export const scoreAlphabetLessonFix: TaskScorer = ({ output, testCase }) => {
  const input = testCase.userInput as AlphabetLessonFixInput;

  return scoreWithCodeChecks({
    check: (text) => checkAlphabetFix({ input, output: text }),
    output,
    scoreCategories: ALPHABET_LESSON_FIX_SCORE_CATEGORIES,
    testCase,
  });
};

import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type Task } from "@/lib/types";
import {
  type AlphabetLessonContent,
  type GenerateAlphabetLessonParams,
  generateAlphabetLesson,
} from "@zoonk/ai/tasks/language/alphabet-lesson";
import { PLAIN_LANGUAGE_CRITERION, readCriteria } from "../plain-language-criterion";
import { ALPHABET_LESSON_SCORE_CATEGORIES } from "./score-categories";
import { checkAlphabetLessonOutput, scoreAlphabetLesson } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const alphabetLessonTask: Task<GenerateAlphabetLessonParams, AlphabetLessonContent> = {
  codeChecks: checkAlphabetLessonOutput,
  criteria: readCriteria(ALPHABET_LESSON_SCORE_CATEGORIES, PLAIN_LANGUAGE_CRITERION),
  description:
    "Write the first alphabet lesson for a non-Latin script: the letters, their sounds for the learner's language, real forms and a short intro: code checks, then a judge",
  generate: generateAlphabetLesson,
  id: "alphabet-lesson",
  name: "Alphabet lesson",
  priorities: {
    comparison: {
      criteria: {
        accuracy: "counts",
        language: "counts",
        pedagogy: "counts",
        plainLanguage: "counts",
      },
      preference: "canBlock",
      trade: COMPARISON_TRADES.core,
      weights: { accuracy: 3 },
    },
    distribution: "shared",
    first: "quality",
    reads: "A learner reads the letters, sounds and intro",
    reason: "Written once per script and learner language and reused, so quality spreads its cost",
    waits: "A learner may wait when the lesson is opened before it's written",
  },
  score: scoreAlphabetLesson,
  scoreCategories: ALPHABET_LESSON_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

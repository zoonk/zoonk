import { type Task } from "@/lib/types";
import {
  type PublishedAlphabetLesson,
  fixAlphabetLesson,
} from "@zoonk/ai/tasks/language/alphabet-lesson";
import { PLAIN_LANGUAGE_CRITERION, readCriteria } from "../plain-language-criterion";
import { ALPHABET_LESSON_FIX_SCORE_CATEGORIES } from "./score-categories";
import { scoreAlphabetLessonFix } from "./scorer";
import { type AlphabetLessonFixInput, TEST_CASES } from "./test-cases";

export const alphabetLessonFixTask: Task<AlphabetLessonFixInput, PublishedAlphabetLesson> = {
  criteria: readCriteria(ALPHABET_LESSON_FIX_SCORE_CATEGORIES, PLAIN_LANGUAGE_CRITERION),
  description:
    "Fix only the parts of an alphabet lesson a reviewer flagged (letter cards, intro screens or the lesson's words), right for the learner's language, and keep everything else as it was",
  generate: fixAlphabetLesson,
  id: "alphabet-lesson-fix",
  name: "Alphabet lesson fix",
  priorities: {
    comparison: {
      criteria: { fixed: "counts", language: "counts", plainLanguage: "counts" },
      preference: "canBlock",
      trade: null,
    },
    distribution: "shared",
    first: "quality",
    reads: "Code applies the fix to a published alphabet lesson that learners read",
    reason: "Fixes reach every learner of the script, and nobody waits on them",
    waits: "Nobody: background work",
  },
  score: scoreAlphabetLessonFix,
  scoreCategories: ALPHABET_LESSON_FIX_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

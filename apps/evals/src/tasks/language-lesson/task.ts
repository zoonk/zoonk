import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type Task } from "@/lib/types";
import {
  type LanguageLessonContent,
  type LanguageLessonParams,
  generateLanguageLesson,
} from "@zoonk/ai/tasks/language/language-lesson";
import { PLAIN_LANGUAGE_CRITERION, readCriteria } from "../plain-language-criterion";
import { LANGUAGE_LESSON_SCORE_CATEGORIES } from "./score-categories";
import { scoreLanguageLesson } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const languageLessonTask: Task<LanguageLessonParams, LanguageLessonContent> = {
  criteria: readCriteria(LANGUAGE_LESSON_SCORE_CATEGORIES, PLAIN_LANGUAGE_CRITERION),
  description:
    "Write a language lesson for one language pair: words with respellings and tips for the learner's language, sentences, a pattern tip with practice, writing and summary",
  generate: generateLanguageLesson,
  id: "language-lesson",
  name: "Language lesson",
  priorities: {
    comparison: {
      criteria: {
        accuracy: "counts",
        pairAwareness: "counts",
        plainLanguage: "counts",
        practiceDesign: "counts",
        situationAndLevel: "counts",
        style: "counts",
      },
      preference: "canBlock",
      trade: COMPARISON_TRADES.core,
      weights: { accuracy: 3 },
    },
    distribution: "shared",
    first: "quality",
    reads: "A learner reads and practices the lesson",
    reason:
      "Shared lessons; the chosen model scored higher at a fraction of the pricier one's cost",
    waits: "Prepared ahead, or a learner waits when it's opened live",
  },
  score: scoreLanguageLesson,
  scoreCategories: LANGUAGE_LESSON_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

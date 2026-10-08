import { type Task } from "@/lib/types";
import {
  type LanguageLessonContent,
  type LanguageLessonParams,
  generateLanguageLesson,
} from "@zoonk/ai/tasks/v2/language/language-lesson";
import { LANGUAGE_LESSON_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

export const languageLessonTask: Task<LanguageLessonParams, LanguageLessonContent> = {
  description:
    "Write a language lesson for one language pair: words with respellings and tips for the learner's language, sentences, a pattern tip with practice, writing and summary",
  generate: generateLanguageLesson,
  id: "language-lesson",
  name: "Language Lesson",
  scoreCategories: LANGUAGE_LESSON_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

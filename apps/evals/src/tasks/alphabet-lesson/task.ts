import { type Task } from "@/lib/types";
import {
  type AlphabetLessonContent,
  type GenerateAlphabetLessonParams,
  generateAlphabetLesson,
} from "@zoonk/ai/tasks/v2/language/alphabet-lesson";
import { ALPHABET_LESSON_SCORE_CATEGORIES } from "./score-categories";
import { scoreAlphabetLesson } from "./scorer";
import { type AlphabetLessonExpected, TEST_CASES } from "./test-cases";

export const alphabetLessonTask: Task<
  GenerateAlphabetLessonParams,
  AlphabetLessonContent,
  AlphabetLessonExpected
> = {
  description:
    "Write the first alphabet lesson for a non-Latin script: the letters, their sounds for the learner's language, real forms and a short intro: code checks, then a judge",
  generate: generateAlphabetLesson,
  id: "alphabet-lesson",
  name: "Alphabet Lesson",
  score: scoreAlphabetLesson,
  scoreCategories: ALPHABET_LESSON_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

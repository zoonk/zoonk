import { type Task } from "@/lib/types";
import {
  type PublishedAlphabetLesson,
  fixAlphabetLesson,
} from "@zoonk/ai/tasks/language/alphabet-lesson";
import { ALPHABET_LESSON_FIX_SCORE_CATEGORIES } from "./score-categories";
import { scoreAlphabetLessonFix } from "./scorer";
import { type AlphabetLessonFixInput, TEST_CASES } from "./test-cases";

export const alphabetLessonFixTask: Task<AlphabetLessonFixInput, PublishedAlphabetLesson> = {
  description:
    "Fix only the alphabet lesson letters a reviewer flagged, with a right sound cue for the learner's language, and keep every other card as it was",
  generate: fixAlphabetLesson,
  id: "alphabet-lesson-fix",
  name: "Alphabet Lesson Fix",
  score: scoreAlphabetLessonFix,
  scoreCategories: ALPHABET_LESSON_FIX_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

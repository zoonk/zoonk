import { type Task } from "@/lib/types";
import {
  type LanguageLessonContent,
  fixLanguageLesson,
} from "@zoonk/ai/tasks/language/language-lesson";
import { scoreLanguageLessonFix } from "./scorer";
import {
  type LanguageLessonFixExpected,
  type LanguageLessonFixInput,
  TEST_CASES,
} from "./test-cases";

export const languageLessonFixTask: Task<
  LanguageLessonFixInput,
  LanguageLessonContent,
  LanguageLessonFixExpected
> = {
  description:
    "Fix what a reviewer found in a published language lesson as its writer: remove real slips, decline a wrong finding, and keep the rest of the lesson as it is",
  generate: fixLanguageLesson,
  id: "language-lesson-fix",
  name: "Language lesson fix",
  priorities: {
    distribution: "shared",
    first: "quality",
    reads: "A checker reads the fixed draft, then learners do",
    reason: "The fix replaces a shared lesson",
    waits: "Same as the language lesson check",
  },
  score: scoreLanguageLessonFix,
  testCases: TEST_CASES,
};

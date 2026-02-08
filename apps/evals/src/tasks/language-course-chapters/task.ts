import { type Task } from "@/lib/types";
import {
  type LanguageCourseChaptersParams,
  type LanguageCourseChaptersSchema,
  generateLanguageCourseChapters,
} from "@zoonk/ai/tasks/courses/language-chapters";
import { TEST_CASES } from "./test-cases";

export const languageCourseChaptersTask: Task<
  LanguageCourseChaptersParams,
  LanguageCourseChaptersSchema
> = {
  description: "Generate chapter outline for a language learning course",
  generate: generateLanguageCourseChapters,
  id: "language-course-chapters",
  name: "Language Course Chapters",
  testCases: TEST_CASES,
};

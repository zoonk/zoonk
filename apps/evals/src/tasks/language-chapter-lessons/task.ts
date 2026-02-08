import { type Task } from "@/lib/types";
import { generateLanguageChapterLessons } from "@zoonk/ai/tasks/chapters/language-lessons";
import { TEST_CASES } from "./test-cases";

export const languageChapterLessonsTask: Task<
  Parameters<typeof generateLanguageChapterLessons>[0],
  Awaited<ReturnType<typeof generateLanguageChapterLessons>>["data"]
> = {
  description: "Generates a list of lessons for a language learning chapter",
  generate: generateLanguageChapterLessons,
  id: "language-chapter-lessons",
  name: "Language Chapter Lessons",
  testCases: TEST_CASES,
};

import { generateChapterLessons } from "@zoonk/ai/chapter-lessons";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const chapterLessonsTask: Task<
  Parameters<typeof generateChapterLessons>[0],
  Awaited<ReturnType<typeof generateChapterLessons>>["data"]
> = {
  description: "Generates a list of lessons for a chapter",
  generate: generateChapterLessons,
  id: "chapter-lessons",
  name: "Chapter Lessons",
  testCases: TEST_CASES,
};

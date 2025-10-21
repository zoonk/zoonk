import { generateChapterLessons } from "@zoonk/ai/chapter-lessons";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const chapterLessonsTask: Task<
  {
    courseTitle: string;
    chapterTitle: string;
    locale: string;
  },
  {
    description: string;
    lessons: string[];
  }
> = {
  id: "chapter-lessons",
  name: "Chapter Lessons",
  description: "Generate chapter description and bite-sized lessons",
  testCases: TEST_CASES,
  generate: generateChapterLessons,
};

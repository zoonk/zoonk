import {
  type CourseChapterAdvancedParams,
  type CourseChaptersSchema,
  generateAdvancedCourseChapters,
} from "@zoonk/ai/course-chapters";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const courseChaptersAdvancedTask: Task<
  CourseChapterAdvancedParams,
  CourseChaptersSchema
> = {
  description:
    "Generate chapter outline for advanced level courses, building upon intermediate knowledge to prepare learners for expert-level roles",
  generate: generateAdvancedCourseChapters,
  id: "course-chapters-advanced",
  name: "Course Chapters - Advanced Level",
  testCases: TEST_CASES,
};

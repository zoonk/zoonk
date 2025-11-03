import {
  type CourseChaptersParams,
  type CourseChaptersSchema,
  generateCourseChapters,
} from "@zoonk/ai/course-chapters";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const courseChaptersAdvancedTask: Task<
  CourseChaptersParams,
  CourseChaptersSchema
> = {
  description:
    "Generate chapter outline for advanced level courses, building upon intermediate knowledge to prepare learners for expert-level roles",
  generate: generateCourseChapters,
  id: "course-chapters-advanced",
  name: "Course Chapters - Advanced Level",
  testCases: TEST_CASES,
};

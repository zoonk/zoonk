import {
  type CourseChaptersParams,
  type CourseChaptersSchema,
  generateCourseChapters,
} from "@zoonk/ai/tasks/courses/chapters";
import { TEST_CASES } from "./test-cases";
import type { Task } from "@/lib/types";

export const courseChaptersTask: Task<CourseChaptersParams, CourseChaptersSchema> = {
  description: "Generate course description and chapter outline for a course",
  generate: generateCourseChapters,
  id: "course-chapters",
  name: "Course Chapters",
  testCases: TEST_CASES,
};

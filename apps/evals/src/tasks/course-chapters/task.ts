import {
  type CourseChaptersParams,
  type CourseChaptersSchema,
  generateCourseChapters,
} from "@zoonk/ai/tasks/courses/chapters";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const courseChaptersTask: Task<
  CourseChaptersParams,
  CourseChaptersSchema
> = {
  description: "Generate course description and chapter outline for a course",
  generate: generateCourseChapters,
  id: "course-chapters",
  name: "Course Chapters",
  testCases: TEST_CASES,
};

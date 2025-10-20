import {
  type CourseChaptersParams,
  type CourseChaptersSchema,
  generateCourseChapters,
} from "@zoonk/ai/course-chapters";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const courseChaptersTask: Task<
  CourseChaptersParams,
  CourseChaptersSchema
> = {
  id: "course-chapters",
  name: "Course Chapters",
  description: "Generate a list of chapters for a course",
  testCases: TEST_CASES,
  generate: generateCourseChapters,
};

import {
  type CourseChaptersParams,
  type CourseChaptersSchema,
  generateCourseChapters,
} from "@zoonk/ai/course-chapters";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const courseChaptersIntermediateTask: Task<
  CourseChaptersParams,
  CourseChaptersSchema
> = {
  description:
    "Generate chapter outline for intermediate level courses, building upon basic knowledge",
  generate: generateCourseChapters,
  id: "course-chapters-intermediate",
  name: "Course Chapters - Intermediate Level",
  testCases: TEST_CASES,
};

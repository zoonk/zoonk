import {
  type CourseChaptersParams,
  type CourseChaptersSchema,
  generateCourseChapters,
} from "@zoonk/ai/course-chapters";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const courseChaptersBasicTask: Task<
  CourseChaptersParams,
  CourseChaptersSchema
> = {
  description:
    "Generate course description and chapter outline for basic/beginner level courses",
  generate: generateCourseChapters,
  id: "course-chapters-basic",
  name: "Course Chapters - Basic Level",
  testCases: TEST_CASES,
};

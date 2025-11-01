import {
  type CourseChapterIntermediateParams,
  type CourseChaptersSchema,
  generateIntermediateCourseChapters,
} from "@zoonk/ai/course-chapters";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const courseChaptersIntermediateTask: Task<
  CourseChapterIntermediateParams,
  CourseChaptersSchema
> = {
  description:
    "Generate chapter outline for intermediate level courses, building upon basic knowledge",
  generate: generateIntermediateCourseChapters,
  id: "course-chapters-intermediate",
  name: "Course Chapters - Intermediate Level",
  testCases: TEST_CASES,
};

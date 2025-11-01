import {
  type CourseChapterBasicParams,
  type CourseChaptersSchema,
  generateBasicCourseChapters,
} from "@zoonk/ai/course-chapters";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const courseChaptersBasicTask: Task<
  CourseChapterBasicParams,
  CourseChaptersSchema
> = {
  description:
    "Generate course description and chapter outline for basic/beginner level courses",
  generate: generateBasicCourseChapters,
  id: "course-chapters-basic",
  name: "Course Chapters - Basic Level",
  testCases: TEST_CASES,
};

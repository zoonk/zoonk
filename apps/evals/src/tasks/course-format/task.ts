import { type Task } from "@/lib/types";
import {
  type CourseFormatParams,
  type CourseFormatSchema,
  classifyCourseFormat,
} from "@zoonk/ai/tasks/courses/format";
import { type CourseFormatExpected, scoreCourseFormat } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const courseFormatTask: Task<CourseFormatParams, CourseFormatSchema, CourseFormatExpected> =
  {
    description: "Classify shared learning prompts into course teaching formats",
    generate: classifyCourseFormat,
    id: "course-format",
    name: "Course Format",
    score: scoreCourseFormat,
    testCases: TEST_CASES,
  };

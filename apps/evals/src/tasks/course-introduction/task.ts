import { type Task } from "@/lib/types";
import {
  type CourseIntroductionParams,
  type CourseIntroductionSchema,
  generateCourseIntroduction,
} from "@zoonk/ai/tasks/courses/introduction";
import { TEST_CASES } from "./test-cases";

export const courseIntroductionTask: Task<CourseIntroductionParams, CourseIntroductionSchema> = {
  description: "Generates the first short introduction chapter for a course",
  generate: generateCourseIntroduction,
  id: "course-introduction",
  name: "Course Introduction",
  testCases: TEST_CASES,
};

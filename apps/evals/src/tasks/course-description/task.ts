import {
  type CourseDescriptionParams,
  type CourseDescriptionSchema,
  generateCourseDescription,
} from "@zoonk/ai/tasks/courses/description";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const courseDescriptionTask: Task<
  CourseDescriptionParams,
  CourseDescriptionSchema
> = {
  description: "Generate a concise 1-3 sentence course description",
  generate: generateCourseDescription,
  id: "course-description",
  name: "Course Description",
  testCases: TEST_CASES,
};

import {
  type CourseCategoriesParams,
  type CourseCategoriesSchema,
  generateCourseCategories,
} from "@zoonk/ai/course-categories";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const courseCategoriesTask: Task<
  CourseCategoriesParams,
  CourseCategoriesSchema
> = {
  description: "Assign one or more categories to a course",
  generate: generateCourseCategories,
  id: "course-categories",
  name: "Course Categories",
  testCases: TEST_CASES,
};

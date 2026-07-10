import { type Task } from "@/lib/types";
import {
  type CourseCategoriesParams,
  type CourseCategoriesSchema,
  generateCourseCategories,
} from "@zoonk/ai/tasks/courses/categories";
import { type CourseCategoriesExpected, scoreCourseCategories } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const courseCategoriesTask: Task<
  CourseCategoriesParams,
  CourseCategoriesSchema,
  CourseCategoriesExpected
> = {
  description: "Assign one or more categories to a course",
  generate: generateCourseCategories,
  id: "course-categories",
  name: "Course Categories",
  score: scoreCourseCategories,
  testCases: TEST_CASES,
};

import { type Task } from "@/lib/types";
import {
  type CourseIdentitySearchParams,
  type CourseIdentitySearchSchema,
  generateCourseIdentitySearchQueries,
} from "@zoonk/ai/tasks/courses/identity-search";
import { TEST_CASES } from "./test-cases";

export const courseIdentitySearchTask: Task<
  CourseIdentitySearchParams,
  CourseIdentitySearchSchema
> = {
  description: "Generate database search queries for finding possible duplicate courses",
  generate: generateCourseIdentitySearchQueries,
  id: "course-identity-search",
  name: "Course Identity Search",
  testCases: TEST_CASES,
};

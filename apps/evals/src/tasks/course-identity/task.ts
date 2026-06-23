import { type Task } from "@/lib/types";
import {
  type CourseIdentityParams,
  type CourseIdentitySchema,
  resolveCourseIdentity,
} from "@zoonk/ai/tasks/courses/identity";
import { TEST_CASES } from "./test-cases";

export const courseIdentityClassificationTask: Task<CourseIdentityParams, CourseIdentitySchema> = {
  description: "Decide whether a proposed course should reuse an existing course",
  generate: resolveCourseIdentity,
  id: "course-identity-classification",
  name: "Course Identity Classification",
  testCases: TEST_CASES,
};

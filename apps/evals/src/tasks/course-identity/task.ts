import { type Task } from "@/lib/types";
import {
  type CourseIdentityParams,
  type CourseIdentitySchema,
  resolveCourseIdentity,
} from "@zoonk/ai/tasks/courses/identity";
import { type CourseIdentityExpected, scoreCourseIdentity } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const courseIdentityClassificationTask: Task<
  CourseIdentityParams,
  CourseIdentitySchema,
  CourseIdentityExpected
> = {
  description: "Decide whether a proposed course should reuse an existing course",
  generate: resolveCourseIdentity,
  id: "course-identity-classification",
  name: "Course Identity Classification",
  score: scoreCourseIdentity,
  testCases: TEST_CASES,
};

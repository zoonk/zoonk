import { type Task } from "@/lib/types";
import {
  type CourseCanonicalTitleParams,
  type CourseCanonicalTitleSchema,
  generateCanonicalCourseTitle,
} from "@zoonk/ai/tasks/courses/canonical-title";
import { type CourseCanonicalTitleExpected, scoreCourseCanonicalTitle } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const courseCanonicalTitleTask: Task<
  CourseCanonicalTitleParams,
  CourseCanonicalTitleSchema,
  CourseCanonicalTitleExpected
> = {
  description: "Generate one canonical title from a course start prompt",
  generate: generateCanonicalCourseTitle,
  id: "course-canonical-title",
  name: "Course Canonical Title",
  score: scoreCourseCanonicalTitle,
  testCases: TEST_CASES,
};

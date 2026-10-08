import { type Task } from "@/lib/types";
import {
  type CourseDetails,
  type CourseDetailsParams,
  generateCourseDetails,
} from "@zoonk/ai/tasks/v2/courses/details";
import { type CourseDetailsExpected, scoreCourseDetails } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const courseDetailsTask: Task<CourseDetailsParams, CourseDetails, CourseDetailsExpected> = {
  description:
    "Write a shared course's public page from its outline: description, landing copy (value, audience, outcomes, uses) and 1 or 2 catalog categories",
  generate: generateCourseDetails,
  id: "course-details",
  name: "Course Details",
  score: scoreCourseDetails,
  testCases: TEST_CASES,
};

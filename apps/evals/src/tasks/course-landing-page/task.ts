import { type Task } from "@/lib/types";
import {
  type CourseLandingPageParams,
  type CourseLandingPageSchema,
  generateCourseLandingPage,
} from "@zoonk/ai/tasks/courses/landing-page";
import { TEST_CASES } from "./test-cases";

export const courseLandingPageTask: Task<CourseLandingPageParams, CourseLandingPageSchema> = {
  description: "Generate structured course landing-page copy",
  generate: generateCourseLandingPage,
  id: "course-landing-page",
  name: "Course Landing Page",
  testCases: TEST_CASES,
};

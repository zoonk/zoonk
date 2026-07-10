import { type Task } from "@/lib/types";
import {
  type CoursePersonalizationParams,
  type CoursePersonalizationSchema,
  classifyCoursePersonalization,
} from "@zoonk/ai/tasks/courses/personalization";
import { type CoursePersonalizationExpected, scoreCoursePersonalization } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const coursePersonalizationTask: Task<
  CoursePersonalizationParams,
  CoursePersonalizationSchema,
  CoursePersonalizationExpected
> = {
  description: "Classify whether learning prompts need personalization",
  generate: classifyCoursePersonalization,
  id: "course-personalization",
  name: "Course Personalization",
  score: scoreCoursePersonalization,
  testCases: TEST_CASES,
};

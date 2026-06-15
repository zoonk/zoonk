import { type Task } from "@/lib/types";
import {
  type CourseLearnLanguageParams,
  type CourseLearnLanguageSchema,
  resolveCourseLearnLanguage,
} from "@zoonk/ai/tasks/courses/learn-language";
import { TEST_CASES } from "./test-cases";

export const courseLearnLanguageTask: Task<CourseLearnLanguageParams, CourseLearnLanguageSchema> = {
  description: "Resolve learner and target languages for language course generation",
  generate: resolveCourseLearnLanguage,
  id: "course-learn-language",
  name: "Course Learn Language",
  testCases: TEST_CASES,
};

import {
  type CourseSuggestionSchema,
  type CourseSuggestionsParams,
  generateCourseSuggestions,
} from "@zoonk/ai/course-suggestions";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const courseSuggestionsTask: Task<
  CourseSuggestionsParams,
  CourseSuggestionSchema["courses"]
> = {
  id: "course-suggestions",
  name: "Course Suggestions",
  description: "Generate course suggestions from user input",
  testCases: TEST_CASES,
  generate: generateCourseSuggestions,
};

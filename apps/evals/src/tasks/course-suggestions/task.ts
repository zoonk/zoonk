import {
  type CourseSuggestionSchema,
  type CourseSuggestionsParams,
  generateCourseSuggestions,
} from "@zoonk/ai/tasks/course-suggestions";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const courseSuggestionsTask: Task<
  CourseSuggestionsParams,
  CourseSuggestionSchema["courses"]
> = {
  description: "Generate course suggestions from user input",
  generate: generateCourseSuggestions,
  id: "course-suggestions",
  name: "Course Suggestions",
  testCases: TEST_CASES,
};

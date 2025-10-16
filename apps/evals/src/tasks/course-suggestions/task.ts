import { generateCourseSuggestions } from "@zoonk/ai/course-suggestions";
import type { Task } from "../../lib/types";
import { TEST_CASES } from "./test-cases";

interface CourseSuggestion {
  title: string;
  description: string;
}

interface CourseSuggestionsInput {
  locale: string;
  prompt: string;
  model: string;
}

export const courseSuggestionsTask: Task<
  CourseSuggestionsInput,
  CourseSuggestion[]
> = {
  id: "course-suggestions",
  name: "Course Suggestions",
  description: "Generate course suggestions from user input",
  testCases: TEST_CASES,
  generate: async ({ locale, prompt, model }) =>
    await generateCourseSuggestions({ locale, prompt, model }),
  formatOutput: (output) => JSON.stringify(output, null, 2),
};

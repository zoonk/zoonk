import { type Task } from "@/lib/types";
import {
  type SuggestProfileToolsInput,
  type SuggestProfileToolsSchema,
  suggestProfileTools,
} from "@zoonk/ai/tasks/profile/suggest-tools";
import { SUGGEST_PROFILE_TOOLS_SCORE_CATEGORIES } from "./score-categories";
import {
  type SuggestProfileToolsExpected,
  checkSuggestProfileTools,
  scoreSuggestProfileTools,
} from "./scorer";
import { TEST_CASES } from "./test-cases";

export const suggestProfileToolsTask: Task<
  SuggestProfileToolsInput,
  SuggestProfileToolsSchema,
  SuggestProfileToolsExpected
> = {
  codeChecks: checkSuggestProfileTools,
  description:
    "Suggest the apps and tools a learner most likely uses, from their job, studies, goals and country",
  generate: suggestProfileTools,
  id: "suggest-profile-tools",
  name: "Suggest profile tools",
  score: scoreSuggestProfileTools,
  scoreCategories: SUGGEST_PROFILE_TOOLS_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

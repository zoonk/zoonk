import {
  type AlternativeTitlesParams,
  type AlternativeTitlesSchema,
  generateAlternativeTitles,
} from "@zoonk/ai/tasks/courses/alternative-titles";
import { TEST_CASES } from "./test-cases";
import type { Task } from "@/lib/types";

export const alternativeTitlesTask: Task<AlternativeTitlesParams, AlternativeTitlesSchema> = {
  description: "Generate alternative course titles with the same meaning",
  generate: generateAlternativeTitles,
  id: "alternative-titles",
  name: "Alternative Titles",
  testCases: TEST_CASES,
};

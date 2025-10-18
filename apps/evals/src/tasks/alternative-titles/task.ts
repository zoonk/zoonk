import {
  type AlternativeTitlesParams,
  type AlternativeTitlesSchema,
  generateAlternativeTitles,
} from "@zoonk/ai/alternative-titles";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const alternativeTitlesTask: Task<
  AlternativeTitlesParams,
  AlternativeTitlesSchema
> = {
  id: "alternative-titles",
  name: "Alternative Titles",
  description: "Generate alternative course titles with the same meaning",
  testCases: TEST_CASES,
  generate: generateAlternativeTitles,
};

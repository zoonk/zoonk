import { type Task } from "@/lib/types";
import {
  type FindMistakePatternParams,
  type FindMistakePatternSchema,
  findMistakePattern,
} from "@zoonk/ai/tasks/v2/language/mistake-pattern";
import { MISTAKE_PATTERN_SCORE_CATEGORIES } from "./score-categories";
import { type MistakePatternExpected, scoreMistakePattern } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const mistakePatternTask: Task<
  FindMistakePatternParams,
  FindMistakePatternSchema,
  MistakePatternExpected
> = {
  description:
    "Name one repeated pattern in a learner's recent language mistakes with a rule, contrast and drill, or say they were typos or unrelated: code checks, then a judge",
  generate: findMistakePattern,
  id: "mistake-pattern",
  name: "Mistake Pattern",
  score: scoreMistakePattern,
  scoreCategories: MISTAKE_PATTERN_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

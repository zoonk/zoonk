import { type Task } from "@/lib/types";
import {
  type FindMistakePatternParams,
  type FindMistakePatternSchema,
  findMistakePattern,
} from "@zoonk/ai/tasks/language/mistake-pattern";
import { readCriteria } from "../plain-language-criterion";
import { MISTAKE_PATTERN_SCORE_CATEGORIES } from "./score-categories";
import { type MistakePatternExpected, scoreMistakePattern } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const mistakePatternTask: Task<
  FindMistakePatternParams,
  FindMistakePatternSchema,
  MistakePatternExpected
> = {
  criteria: readCriteria(MISTAKE_PATTERN_SCORE_CATEGORIES),
  description:
    "Name one repeated pattern in a learner's recent language mistakes with a rule, contrast and drill, or say they were typos or unrelated: code checks, then a judge",
  generate: findMistakePattern,
  id: "mistake-pattern",
  name: "Mistake pattern",
  priorities: {
    comparison: {
      criteria: { drill: "counts", language: "counts", rule: "counts" },
      preference: "separates",
      trade: null,
    },
    distribution: "private",
    first: "cost",
    reads: "A learner reads the pattern and does its drill",
    reason: "Private and in the background; the cheaper model kept the rules true",
    waits: "Nobody: background work",
  },
  score: scoreMistakePattern,
  scoreCategories: MISTAKE_PATTERN_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

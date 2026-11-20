import { type OptionalCountry, type Task } from "@/lib/types";
import {
  type ExplainWrongAnswerParams,
  type ExplainWrongAnswerSchema,
  explainWrongAnswer,
} from "@zoonk/ai/tasks/grading/explain-wrong-answer";
import { readCriteria } from "../plain-language-criterion";
import { EXPLAIN_WRONG_ANSWER_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

export const explainWrongAnswerTask: Task<
  OptionalCountry<ExplainWrongAnswerParams>,
  ExplainWrongAnswerSchema
> = {
  criteria: readCriteria(EXPLAIN_WRONG_ANSWER_SCORE_CATEGORIES),
  description:
    "Explain why a typed or spoken answer is wrong, for everyone who gives the same answer (stored and reused)",
  generate: (input) => explainWrongAnswer({ ...input, country: input.country ?? null }),
  id: "explain-wrong-answer",
  name: "Explain wrong answer",
  priorities: {
    comparison: {
      criteria: {
        accuracy: "counts",
        clarity: "counts",
        diagnosis: "counts",
        reusableTone: "counts",
      },
      preference: "canBlock",
      trade: null,
    },
    distribution: "shared",
    first: "quality",
    reads: "A learner reads why their answer is wrong",
    reason: "Made once per mistake and shared, so quality wins",
    waits: "A learner waits when no stored explanation exists",
  },
  scoreCategories: EXPLAIN_WRONG_ANSWER_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

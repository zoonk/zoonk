import { type OptionalCountry, type Task } from "@/lib/types";
import {
  type ExplainWrongAnswerParams,
  type ExplainWrongAnswerSchema,
  explainWrongAnswer,
} from "@zoonk/ai/tasks/grading/explain-wrong-answer";
import { EXPLAIN_WRONG_ANSWER_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

export const explainWrongAnswerTask: Task<
  OptionalCountry<ExplainWrongAnswerParams>,
  ExplainWrongAnswerSchema
> = {
  description:
    "Explain why a typed or spoken answer is wrong, for everyone who gives the same answer (stored and reused)",
  generate: (input) => explainWrongAnswer({ ...input, country: input.country ?? null }),
  id: "explain-wrong-answer",
  name: "Explain Wrong Answer",
  scoreCategories: EXPLAIN_WRONG_ANSWER_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

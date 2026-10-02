import { type Task } from "@/lib/types";
import {
  type ExplainWrongAnswerParams,
  type ExplainWrongAnswerSchema,
  explainWrongAnswer,
} from "@zoonk/ai/tasks/v2/grading/explain-wrong-answer";
import { EXPLAIN_WRONG_ANSWER_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

export const explainWrongAnswerTask: Task<ExplainWrongAnswerParams, ExplainWrongAnswerSchema> = {
  description:
    "Explain why a typed or spoken answer is wrong, for everyone who gives the same answer (stored and reused)",
  generate: explainWrongAnswer,
  id: "explain-wrong-answer",
  name: "Explain Wrong Answer",
  scoreCategories: EXPLAIN_WRONG_ANSWER_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

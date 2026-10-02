import { type Task } from "@/lib/types";
import {
  type ExplainSpokenAnswerParams,
  type ExplainSpokenAnswerSchema,
  explainSpokenAnswer,
} from "@zoonk/ai/tasks/v2/language/explain-spoken-answer";
import { EXPLAIN_SPOKEN_ANSWER_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

export const explainSpokenAnswerTask: Task<ExplainSpokenAnswerParams, ExplainSpokenAnswerSchema> = {
  description:
    "Explain the words of a spoken answer that didn't match, from how the learner's own language works (stored and reused)",
  generate: explainSpokenAnswer,
  id: "explain-spoken-answer",
  name: "Explain Spoken Answer",
  scoreCategories: EXPLAIN_SPOKEN_ANSWER_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

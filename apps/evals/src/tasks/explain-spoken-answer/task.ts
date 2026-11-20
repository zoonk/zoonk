import { type Task } from "@/lib/types";
import {
  type ExplainSpokenAnswerParams,
  type ExplainSpokenAnswerSchema,
  explainSpokenAnswer,
} from "@zoonk/ai/tasks/language/explain-spoken-answer";
import { PLAIN_LANGUAGE_CRITERION, readCriteria } from "../plain-language-criterion";
import { EXPLAIN_SPOKEN_ANSWER_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

export const explainSpokenAnswerTask: Task<ExplainSpokenAnswerParams, ExplainSpokenAnswerSchema> = {
  criteria: readCriteria(EXPLAIN_SPOKEN_ANSWER_SCORE_CATEGORIES, PLAIN_LANGUAGE_CRITERION),
  description:
    "Explain the words of a spoken answer that didn't match, from how the learner's own language works (stored and reused)",
  generate: explainSpokenAnswer,
  id: "explain-spoken-answer",
  name: "Explain spoken answer",
  priorities: {
    comparison: {
      criteria: {
        accuracy: "counts",
        helpfulness: "counts",
        plainLanguage: "counts",
        style: "counts",
      },
      preference: "canBlock",
      trade: null,
    },
    distribution: "shared",
    first: "quality",
    reads: "A learner reads why their spoken answer was heard wrong",
    reason: "Stored and reused for everyone who says the same thing",
    waits: "Code doesn't say; most likely the learner's request",
  },
  scoreCategories: EXPLAIN_SPOKEN_ANSWER_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

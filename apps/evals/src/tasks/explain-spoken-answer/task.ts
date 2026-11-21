import { LEARNER_INSTRUCTIONS } from "@/lib/comparisons/learner-instructions";
import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
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
  criteria: readCriteria(
    EXPLAIN_SPOKEN_ANSWER_SCORE_CATEGORIES,
    PLAIN_LANGUAGE_CRITERION,
    LEARNER_INSTRUCTIONS,
  ),
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
        learnerInstructions: "disqualifies",
        plainLanguage: "counts",
        style: "counts",
      },
      preference: "canBlock",
      trade: COMPARISON_TRADES.core,
      weights: { accuracy: 3 },
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

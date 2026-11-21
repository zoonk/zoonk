import { LEARNER_INSTRUCTIONS } from "@/lib/comparisons/learner-instructions";
import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type Task } from "@/lib/types";
import {
  type WriteConversationFeedbackParams,
  type WriteConversationFeedbackSchema,
  writeConversationFeedback,
} from "@zoonk/ai/tasks/language/conversation-feedback";
import { PLAIN_LANGUAGE_CRITERION, readCriteria } from "../plain-language-criterion";
import { CONVERSATION_FEEDBACK_SCORE_CATEGORIES } from "./score-categories";
import { scoreConversationFeedback } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const conversationFeedbackTask: Task<
  WriteConversationFeedbackParams,
  WriteConversationFeedbackSchema
> = {
  criteria: readCriteria(
    CONVERSATION_FEEDBACK_SCORE_CATEGORIES,
    PLAIN_LANGUAGE_CRITERION,
    LEARNER_INSTRUCTIONS,
  ),
  description:
    "Write feedback after a live call: phrases said well, one fix, hard words for the learner's language and a kind line: code checks, then a judge",
  generate: writeConversationFeedback,
  id: "conversation-feedback",
  name: "Conversation feedback",
  priorities: {
    comparison: {
      criteria: {
        fix: "counts",
        honesty: "counts",
        language: "counts",
        learnerInstructions: "disqualifies",
        plainLanguage: "counts",
        tone: "counts",
      },
      preference: "separates",
      trade: COMPARISON_TRADES.private,
      weights: { fix: 3, honesty: 3, tone: 3 },
    },
    distribution: "private",
    first: "latency",
    reads: "A learner reads it right after a call",
    reason: "The learner waits for it, so a faster model was chosen over a cheaper one",
    waits: "A learner waits right after the call ends",
  },
  score: scoreConversationFeedback,
  scoreCategories: CONVERSATION_FEEDBACK_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

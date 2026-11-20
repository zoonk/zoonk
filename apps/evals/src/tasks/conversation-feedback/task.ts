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
  criteria: readCriteria(CONVERSATION_FEEDBACK_SCORE_CATEGORIES, PLAIN_LANGUAGE_CRITERION),
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
        plainLanguage: "counts",
        tone: "disqualifies",
      },
      preference: "separates",
      trade: null,
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

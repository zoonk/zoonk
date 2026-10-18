import { type Task } from "@/lib/types";
import {
  type WriteConversationFeedbackParams,
  type WriteConversationFeedbackSchema,
  writeConversationFeedback,
} from "@zoonk/ai/tasks/v2/language/conversation-feedback";
import { CONVERSATION_FEEDBACK_SCORE_CATEGORIES } from "./score-categories";
import { scoreConversationFeedback } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const conversationFeedbackTask: Task<
  WriteConversationFeedbackParams,
  WriteConversationFeedbackSchema
> = {
  description:
    "Write feedback after a live call: phrases said well, one fix, hard words for the learner's language and a kind line: code checks, then a judge",
  generate: writeConversationFeedback,
  id: "conversation-feedback",
  name: "Conversation Feedback",
  score: scoreConversationFeedback,
  scoreCategories: CONVERSATION_FEEDBACK_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

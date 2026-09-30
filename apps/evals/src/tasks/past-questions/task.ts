import { type Task } from "@/lib/types";
import {
  type ExtractPastQuestionsParams,
  extractPastQuestions,
} from "@zoonk/ai/tasks/v2/items/past-questions";
import { PAST_QUESTIONS_SCORE_CATEGORIES } from "./score-categories";
import { scorePastQuestions } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const pastQuestionsTask: Task<
  ExtractPastQuestionsParams,
  Awaited<ReturnType<typeof extractPastQuestions>>["data"]
> = {
  description:
    "Copy real past exam questions where the organizer allows it: code checks every quoted part against the paper and the citation, then a judge on keys, which questions, feedback and credit",
  generate: extractPastQuestions,
  id: "past-questions",
  name: "Past Questions",
  score: scorePastQuestions,
  scoreCategories: PAST_QUESTIONS_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

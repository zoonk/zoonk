import { type Task } from "@/lib/types";
import {
  type ExtractPastQuestionsParams,
  extractPastQuestions,
} from "@zoonk/ai/tasks/items/past-questions";
import { readCriteria } from "../plain-language-criterion";
import { PAST_QUESTIONS_SCORE_CATEGORIES } from "./score-categories";
import { scorePastQuestions } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const pastQuestionsTask: Task<
  ExtractPastQuestionsParams,
  Awaited<ReturnType<typeof extractPastQuestions>>["data"]
> = {
  criteria: readCriteria(PAST_QUESTIONS_SCORE_CATEGORIES),
  description:
    "Copy real past exam questions where the organizer allows it: code checks every quoted part against the paper and the citation, then a judge on keys, which questions, feedback and credit",
  generate: extractPastQuestions,
  id: "past-questions",
  name: "Past questions",
  priorities: {
    comparison: {
      criteria: {
        citation: "counts",
        feedback: "counts",
        keys: "disqualifies",
        selection: "counts",
      },
      preference: "canBlock",
      trade: null,
    },
    distribution: "shared",
    first: "quality",
    reads: "A learner practices real past-paper questions",
    reason:
      "Must copy papers exactly and key them right for every learner; the chosen model also cost a twentieth",
    waits: "Prepared ahead in a workflow, before a learner needs it",
  },
  score: scorePastQuestions,
  scoreCategories: PAST_QUESTIONS_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

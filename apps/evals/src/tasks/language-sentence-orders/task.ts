import { type Task } from "@/lib/types";
import {
  type LanguageSentenceOrders,
  generateLanguageSentenceOrders,
} from "@zoonk/ai/tasks/language/language-sentence-orders";
import { SENTENCE_ORDERS_SCORE_CATEGORIES } from "./score-categories";
import { checkLanguageSentenceOrders, scoreLanguageSentenceOrders } from "./scorer";
import { type SentenceOrdersExpected, type SentenceOrdersInput, TEST_CASES } from "./test-cases";

export const languageSentenceOrdersTask: Task<
  SentenceOrdersInput,
  LanguageSentenceOrders,
  SentenceOrdersExpected
> = {
  codeChecks: checkLanguageSentenceOrders,
  description:
    "Write the other word orders a native teacher accepts for a lesson's sentences and their translations, so learners building them from tiles aren't marked wrong for a correct order",
  generate: generateLanguageSentenceOrders,
  id: "language-sentence-orders",
  name: "Language Sentence Orders",
  score: scoreLanguageSentenceOrders,
  scoreCategories: SENTENCE_ORDERS_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

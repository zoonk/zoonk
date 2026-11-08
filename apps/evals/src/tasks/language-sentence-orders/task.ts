import { type Task } from "@/lib/types";
import { generateLanguageSentenceOrders } from "@zoonk/ai/tasks/language/language-sentence-orders";
import {
  checkOrderCandidates,
  toOrderCandidates,
} from "@zoonk/core/library/language/sentence-orders";
import { isSameLanguage } from "@zoonk/utils/languages";
import { SENTENCE_ORDERS_SCORE_CATEGORIES } from "./score-categories";
import {
  type CheckedSentenceOrders,
  checkLanguageSentenceOrders,
  scoreLanguageSentenceOrders,
} from "./scorer";
import { type SentenceOrdersExpected, type SentenceOrdersInput, TEST_CASES } from "./test-cases";

/** The pipeline production runs: the model under test generates, then the reviewer keeps what a teacher accepts. */
async function generateCheckedOrders(input: Parameters<typeof generateLanguageSentenceOrders>[0]) {
  const generated = await generateLanguageSentenceOrders(input);

  const candidates = toOrderCandidates({
    generated: generated.data,
    sameLanguage: isSameLanguage(input),
    sentences: input.sentences,
  });

  const kept = await checkOrderCandidates({ ...input, candidates });

  const data: CheckedSentenceOrders = {
    sentences: kept.map((orders, index) => ({ ...orders, candidates: candidates[index] })),
  };

  return { ...generated, data };
}

export const languageSentenceOrdersTask: Task<
  SentenceOrdersInput,
  CheckedSentenceOrders,
  SentenceOrdersExpected
> = {
  codeChecks: checkLanguageSentenceOrders,
  description:
    "Generate other word orders for a lesson's sentences and their translations, keep the buildable ones and review them, so learners building them from tiles aren't marked wrong for a correct order",
  generate: generateCheckedOrders,
  id: "language-sentence-orders",
  name: "Language Sentence Orders",
  score: scoreLanguageSentenceOrders,
  scoreCategories: SENTENCE_ORDERS_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

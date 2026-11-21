import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type Task } from "@/lib/types";
import { generateLanguageSentenceOrders } from "@zoonk/ai/tasks/language/language-sentence-orders";
import {
  checkOrderCandidates,
  toOrderCandidates,
} from "@zoonk/core/library/language/sentence-orders";
import { isSameLanguage } from "@zoonk/utils/languages";
import { readCriteria } from "../plain-language-criterion";
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
  criteria: readCriteria(SENTENCE_ORDERS_SCORE_CATEGORIES),
  description:
    "Generate other word orders for a lesson's sentences and their translations, keep the buildable ones and review them, so learners building them from tiles aren't marked wrong for a correct order",
  generate: generateCheckedOrders,
  id: "language-sentence-orders",
  name: "Language sentence orders",
  priorities: {
    comparison: {
      criteria: { precision: "counts", recall: "counts" },
      preference: "canBlock",
      trade: COMPARISON_TRADES.core,
      weights: { precision: 3 },
    },
    distribution: "shared",
    first: "quality",
    reads: "Code accepts these orders as right answers in an exercise",
    reason: "A wrong order marks a learner's wrong sentence right for every learner",
    waits: "Prepared ahead in a workflow, before a learner needs it",
  },
  score: scoreLanguageSentenceOrders,
  scoreCategories: SENTENCE_ORDERS_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

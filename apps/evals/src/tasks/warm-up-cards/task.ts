import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type OptionalCountry, type Task } from "@/lib/types";
import {
  type RawWarmUpCard,
  WARM_UP_DECK_SIZE,
  toWarmUpCards,
} from "@zoonk/ai/tasks/warm-up/warm-up-cards";
import {
  type WriteWarmUpCardsParams,
  generateWarmUpCards,
} from "@zoonk/ai/tasks/warm-up/write-warm-up-cards";
import { readCriteria } from "../plain-language-criterion";
import { WARM_UP_CARDS_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

type WarmUpCardsOutput = { cards: RawWarmUpCard[] };

/**
 * The judge reads the cards the pipeline would keep, as learners would see them. A deck with fewer
 * cards than one shows is never shown, so none of it passes.
 */
function checkOutput(output: string): CodeCheckResult {
  const { cards } = JSON.parse(output) as WarmUpCardsOutput;
  const kept = toWarmUpCards(cards);
  const keptIds = new Set(kept.map((card) => card.id));
  const shown = kept.length >= WARM_UP_DECK_SIZE.min;

  const dropped = cards.flatMap((card, index) =>
    keptIds.has(String(index + 1)) ? [] : [`Card ${index + 1} ("${card.question}")`],
  );

  return {
    judgedOutput: JSON.stringify({ cards: kept }, null, 1),
    passed: shown ? kept.length : 0,
    problems: [
      ...(dropped.length > 0
        ? [`${dropped.join(", ")} failed the code checks and would be dropped.`]
        : []),
      ...(shown ? [] : [`Only ${kept.length} cards passed, too few for a deck.`]),
    ],
    total: cards.length,
  };
}

export const warmUpCardsTask: Task<OptionalCountry<WriteWarmUpCardsParams>, WarmUpCardsOutput> = {
  criteria: readCriteria(WARM_UP_CARDS_SCORE_CATEGORIES),
  description:
    "Write about 10 guess cards (a question, 2 or 3 options with one right, a short reveal) a new learner plays while their plan is built: the shared validator, then a judge",
  generate: (input) => generateWarmUpCards({ ...input, country: input.country ?? null }),
  id: "warm-up-cards",
  name: "Warm-up cards",
  priorities: {
    comparison: {
      criteria: { accuracy: "counts", format: "counts", language: "counts", pretest: "counts" },
      preference: "canBlock",
      trade: COMPARISON_TRADES.shared,
      weights: { accuracy: 3 },
    },
    distribution: "shared",
    first: "quality",
    reads: "A learner plays the warm-up deck",
    reason:
      "A deck is shared, and a checker drops doubtful cards; the chosen model is cheap and fast enough",
    waits: "A learner waits during the goal build",
  },
  score: ({ output, testCase }) =>
    scoreWithCodeChecks({
      check: checkOutput,
      output,
      scoreCategories: WARM_UP_CARDS_SCORE_CATEGORIES,
      testCase,
    }),
  scoreCategories: WARM_UP_CARDS_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

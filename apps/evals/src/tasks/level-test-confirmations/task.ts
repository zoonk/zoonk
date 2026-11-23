import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type Task } from "@/lib/types";
import {
  type GenerateLevelTestConfirmationsParams,
  type LevelTestConfirmation,
  generateLevelTestConfirmations,
} from "@zoonk/ai/tasks/language/level-test-confirmations";
import { readCriteria } from "../plain-language-criterion";
import { LEVEL_TEST_CONFIRMATIONS_SCORE_CATEGORIES } from "./score-categories";
import { checkLevelTestConfirmations, scoreLevelTestConfirmations } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const levelTestConfirmationsTask: Task<
  GenerateLevelTestConfirmationsParams,
  { confirmations: LevelTestConfirmation[] }
> = {
  codeChecks: checkLevelTestConfirmations,
  criteria: readCriteria(LEVEL_TEST_CONFIRMATIONS_SCORE_CATEGORIES),
  description:
    'Write one level\'s confirmation questions for a language pair: 2 reading and 2 listening "select all that apply" questions over 5 or 6 options that confirm a level before its lessons are skipped: code checks, then a judge',
  generate: generateLevelTestConfirmations,
  id: "level-test-confirmations",
  name: "Level test confirmations",
  priorities: {
    comparison: {
      criteria: { answers: "counts", calibration: "counts", language: "counts" },
      preference: "canBlock",
      trade: COMPARISON_TRADES.shared,
      weights: { answers: 3 },
    },
    distribution: "shared",
    first: "quality",
    reads: "Learners who are close to skipping a level",
    reason: "One set of questions can skip lessons for many learners of the same language pair",
    waits: "Prepared ahead in the language test bank",
  },
  requiresAnswerKeyCheck: true,
  score: scoreLevelTestConfirmations,
  scoreCategories: LEVEL_TEST_CONFIRMATIONS_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

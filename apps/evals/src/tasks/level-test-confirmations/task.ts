import { type Task } from "@/lib/types";
import {
  type GenerateLevelTestConfirmationsParams,
  type LevelTestConfirmation,
  generateLevelTestConfirmations,
} from "@zoonk/ai/tasks/language/level-test-confirmations";
import { LEVEL_TEST_CONFIRMATIONS_SCORE_CATEGORIES } from "./score-categories";
import { checkLevelTestConfirmations, scoreLevelTestConfirmations } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const levelTestConfirmationsTask: Task<
  GenerateLevelTestConfirmationsParams,
  { confirmations: LevelTestConfirmation[] }
> = {
  codeChecks: checkLevelTestConfirmations,
  description:
    'Write one level\'s confirmation questions for a language pair: 2 reading and 2 listening "select all that apply" questions over 5 or 6 options that confirm a level before its lessons are skipped: code checks, then a judge',
  generate: generateLevelTestConfirmations,
  id: "level-test-confirmations",
  name: "Level test confirmations",
  score: scoreLevelTestConfirmations,
  scoreCategories: LEVEL_TEST_CONFIRMATIONS_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

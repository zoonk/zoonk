import { type Task } from "@/lib/types";
import {
  type GenerateLevelTestBankParams,
  type GenerateLevelTestBankSchema,
  generateLevelTestBank,
} from "@zoonk/ai/tasks/v2/language/level-test-bank";
import { LEVEL_TEST_BANK_SCORE_CATEGORIES } from "./score-categories";
import { scoreLevelTestBank } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const levelTestBankTask: Task<GenerateLevelTestBankParams, GenerateLevelTestBankSchema> = {
  description:
    "Write the placement test bank for a language pair: 2 reading and 2 listening questions per level from A1 to C1 and one sentence per level to say: code checks, then a judge",
  generate: generateLevelTestBank,
  id: "level-test-bank",
  name: "Level Test Bank",
  score: scoreLevelTestBank,
  scoreCategories: LEVEL_TEST_BANK_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

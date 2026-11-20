import { type Task } from "@/lib/types";
import {
  type GenerateLevelTestBankParams,
  type GenerateLevelTestBankSchema,
  generateLevelTestBank,
} from "@zoonk/ai/tasks/language/level-test-bank";
import { readCriteria } from "../plain-language-criterion";
import { LEVEL_TEST_BANK_SCORE_CATEGORIES } from "./score-categories";
import { checkLevelTestBank, scoreLevelTestBank } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const levelTestBankTask: Task<GenerateLevelTestBankParams, GenerateLevelTestBankSchema> = {
  codeChecks: checkLevelTestBank,
  criteria: readCriteria(LEVEL_TEST_BANK_SCORE_CATEGORIES),
  description:
    "Write the placement test bank for a language pair: 2 reading and 2 listening questions per level from A1 to C1 and one sentence per level to say: code checks, then a judge",
  generate: generateLevelTestBank,
  id: "level-test-bank",
  name: "Level test bank",
  priorities: {
    comparison: {
      criteria: { answers: "disqualifies", calibration: "counts", language: "counts" },
      preference: "canBlock",
      trade: null,
    },
    distribution: "shared",
    first: "quality",
    reads: "A learner takes the placement test",
    reason: "One bank per language pair places every learner of the pair",
    waits: "Prepared ahead in a workflow, before a learner needs it",
  },
  score: scoreLevelTestBank,
  scoreCategories: LEVEL_TEST_BANK_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

import { type Task } from "@/lib/types";
import {
  type GenerateLevelTestBankParams,
  type LevelTestQuestion,
  generateLevelTestBank,
} from "@zoonk/ai/tasks/language/level-test-bank";
import { LEVEL_TEST_BANK_SCORE_CATEGORIES } from "./score-categories";
import { checkLevelTestBank, scoreLevelTestBank } from "./scorer";
import { TEST_CASES } from "./test-cases";

/** A few per level and skill, so a judge reads every level of a bank side by side. */
const QUESTIONS_PER_SKILL = 2;

export const levelTestBankTask: Task<
  GenerateLevelTestBankParams,
  { questions: LevelTestQuestion[] }
> = {
  codeChecks: checkLevelTestBank,
  description:
    "Write the placement test bank's questions for a language pair, 2 reading and 2 listening per level from A1 to C2 (the bank holds 12 of each, written by the same prompt): code checks, then a judge",
  generate: (input) => generateLevelTestBank({ ...input, questionsPerSkill: QUESTIONS_PER_SKILL }),
  id: "level-test-bank",
  name: "Level test bank",
  score: scoreLevelTestBank,
  scoreCategories: LEVEL_TEST_BANK_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

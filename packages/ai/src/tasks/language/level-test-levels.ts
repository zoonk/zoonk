import { type CefrLevel } from "@zoonk/utils/cefr";

export const LEVEL_TEST_LEVELS = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
] as const satisfies readonly CefrLevel[];

export type TestLevel = (typeof LEVEL_TEST_LEVELS)[number];

export const LEVEL_TEST_SKILLS = ["reading", "listening"] as const;

export type LevelTestSkill = (typeof LEVEL_TEST_SKILLS)[number];

type WordRange = { max: number; min: number };

/**
 * Voice messages play at speaking pace, so they're shorter, and an advanced learner's questions
 * still take a few minutes. The eval's code checks read the same limits.
 */
export const LEVEL_TEST_PASSAGE_WORDS = {
  A1: { listening: { max: 25, min: 10 }, reading: { max: 25, min: 8 } },
  A2: { listening: { max: 40, min: 25 }, reading: { max: 45, min: 25 } },
  B1: { listening: { max: 65, min: 45 }, reading: { max: 75, min: 50 } },
  B2: { listening: { max: 85, min: 60 }, reading: { max: 100, min: 70 } },
  C1: { listening: { max: 100, min: 75 }, reading: { max: 120, min: 90 } },
  C2: { listening: { max: 120, min: 90 }, reading: { max: 150, min: 110 } },
} as const satisfies Record<TestLevel, Record<LevelTestSkill, WordRange>>;

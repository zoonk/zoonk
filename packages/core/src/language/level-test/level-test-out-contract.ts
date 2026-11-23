import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { studyAnswerInputSchema } from "../../sessions/contract";
import { tapAnswerSchema } from "../../sessions/tap-answer-contract";
import { levelTestOutLevelSchema } from "./level-test-contract";

export const levelTestOutAnswerSchema = studyAnswerInputSchema
  .extend({ answer: z.union(tapAnswerSchema.options), attemptId: uuidSchema() })
  .meta({ id: "LanguageLevelTestOutAnswerInput" });

export const levelTestOutFinishSchema = z
  .object({ attemptId: uuidSchema() })
  .strict()
  .meta({ id: "LanguageLevelTestOutFinishInput" });

const testOutQuestionSchema = z.object({
  id: uuidSchema(),
  skill: z.enum(["reading", "listening"]),
  skillId: uuidSchema(),
});

const testOutResultSchema = z.object({
  finishedAt: z.iso.datetime(),
  planItemIds: z.array(uuidSchema()),
  topicsSkipped: z.array(uuidSchema()),
});

export const levelTestOutProgressSchema = z.object({
  id: uuidSchema(),
  level: levelTestOutLevelSchema,
  preparingUntil: z.iso.datetime().optional(),
  questions: z.array(testOutQuestionSchema),
  result: testOutResultSchema.optional(),
});

export type LevelTestOutProgress = z.infer<typeof levelTestOutProgressSchema>;
export type LevelTestOutLevel = z.infer<typeof levelTestOutLevelSchema>;
export type LevelTestOutAnswer = z.infer<typeof levelTestOutAnswerSchema>;

export function isPreparingLevelTestOut(testOut: LevelTestOutProgress) {
  return Boolean(testOut.preparingUntil && Date.parse(testOut.preparingUntil) > Date.now());
}

export function isOpenLevelTestOut(testOut: LevelTestOutProgress | undefined) {
  return Boolean(
    testOut &&
    !testOut.result &&
    (testOut.questions.length > 0 || isPreparingLevelTestOut(testOut)),
  );
}

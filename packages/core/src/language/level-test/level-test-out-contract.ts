import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { studyAnswerInputSchema } from "../../sessions/contract";
import { levelTestOutLevelSchema } from "./level-test-contract";

const [choice, match, ...rest] = studyAnswerInputSchema.shape.answer.options;
const order = rest[2];

export const levelTestOutAnswerSchema = studyAnswerInputSchema
  .extend({ answer: z.union([choice, match, order]), attemptId: uuidSchema() })
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
  unannounced: z.array(uuidSchema()),
});

export const levelTestOutProgressSchema = z.object({
  id: uuidSchema(),
  level: levelTestOutLevelSchema,
  questions: z.array(testOutQuestionSchema),
  result: testOutResultSchema.optional(),
});

export type LevelTestOutProgress = z.infer<typeof levelTestOutProgressSchema>;
export type LevelTestOutLevel = z.infer<typeof levelTestOutLevelSchema>;
export type LevelTestOutAnswer = z.infer<typeof levelTestOutAnswerSchema>;

import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

export const checkpointAnsweredQuestionsSchema = z
  .array(z.object({ isCorrect: z.boolean(), itemId: uuidSchema() }))
  .optional()
  .meta({
    description: "Saved checkpoint verdicts, including questions whose content was removed",
  });

export const checkpointEndedWithoutQuestionsSchema = z
  .boolean()
  .optional()
  .meta({ description: "Ended without a verdict because no remaining question could be asked" });

export const checkpointPhaseSchema = z
  .object({ index: z.number().int().min(0), name: z.string() })
  .meta({ id: "CheckpointPhase" });

export const checkpointKindSchema = z
  .enum(["boss", "finalBoss", "weekly"])
  .meta({ description: "A phase boss, the final boss or the weekly Big Challenge" });

import { checkpointRefSchema } from "@zoonk/core/sessions/day-block";
import { z } from "zod";

export const checkpointAnsweredQuestionsSchema = z
  .array(z.object({ isCorrect: z.boolean(), itemId: z.uuid() }))
  .optional()
  .meta({
    description: "Saved checkpoint verdicts, including questions whose content was removed",
  });

export const checkpointEndedWithoutQuestionsSchema = z
  .boolean()
  .optional()
  .meta({ description: "Ended without a verdict because no remaining question could be asked" });

const checkpointDetails = {
  passMark: z.int().min(0).meta({ description: "Right answers needed to win" }),
  timeLimitMinutes: z.int().min(0).nullable(),
};

export const studyCheckpointSchema = z
  .discriminatedUnion("mock", [
    checkpointRefSchema.options[0].extend(checkpointDetails),
    checkpointRefSchema.options[1].extend(checkpointDetails),
  ])
  .meta({ id: "StudyCheckpoint" });

export const checkpointPhaseSchema = z
  .object({ index: z.number().int().min(0), name: z.string() })
  .meta({ id: "CheckpointPhase" });

export const checkpointKindSchema = z
  .enum(["boss", "finalBoss", "weekly"])
  .meta({ description: "A phase boss, the final boss or the weekly Big Challenge" });

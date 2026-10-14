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

export const studyCheckpointSchema = z
  .object({
    kind: z
      .enum(["boss", "finalBoss", "weekly"])
      .meta({
        description:
          "A phase boss, the final boss that closes the plan, or the weekly Big Challenge",
      }),
    mock: z
      .boolean()
      .meta({ description: "An exam's weekly mock, which feeds the estimated score" }),
    passMark: z
      .number()
      .int()
      .min(0)
      .meta({ description: "Right answers needed to win: seven of ten" }),
    phase: z.number().int().min(0).nullable(),
    rematch: z.boolean().meta({ description: "A boss lost on an earlier day, back again" }),
    timeLimitMinutes: z.number().int().min(0).nullable(),
  })
  .meta({ id: "StudyCheckpoint" });

export const checkpointPhaseSchema = z
  .object({ index: z.number().int().min(0), name: z.string() })
  .meta({ id: "CheckpointPhase" });

export const checkpointKindSchema = z
  .enum(["boss", "finalBoss", "weekly"])
  .meta({ description: "A phase boss, the final boss or the weekly Big Challenge" });

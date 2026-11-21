import { type EssayView } from "@zoonk/core/exams/essays/contract";
import {
  writingDraftSchema,
  writingPacingSchema,
  writingPromptSchema,
  writingResultSchema,
} from "@zoonk/core/exams/essays/writing-contract";
import { StudyBlockStatus } from "@zoonk/db";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

export const essayViewResponseSchema = z
  .object({
    blockId: uuidSchema(),
    context: z.string().nullable(),
    draft: writingDraftSchema.nullable(),
    drafts: z.array(
      z.object({
        attemptId: uuidSchema(),
        grade: writingResultSchema,
        submittedAt: z.iso.datetime(),
        text: z.string(),
      }),
    ),
    gradesLeft: z
      .number()
      .int()
      .min(0)
      .describe(
        "Extra writing starts left today. A scheduled or already admitted answer can still be submitted.",
      ),
    pacing: writingPacingSchema,
    question: z.string(),
    rubric: z
      .enum(["enem", "oab", "points", "levels"])
      .meta({ description: "The scoring rubric recorded with the writing prompt" }),
    sessionId: uuidSchema(),
    status: z.enum(StudyBlockStatus),
    writing: writingPromptSchema,
  })
  .meta({ id: "Essay" }) satisfies z.ZodType<EssayView>;

export const writingAttemptPathParamsSchema = z.object({ attemptId: uuidSchema() });

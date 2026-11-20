import {
  type EssayView,
  type WrittenEssayDraft,
  essayGradeSchema,
} from "@zoonk/core/exams/essays/contract";
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
    draft: writingDraftSchema.nullable().optional(),
    drafts: z.array(
      z.union([
        z.object({
          attemptId: uuidSchema().optional(),
          grade: essayGradeSchema,
          submittedAt: z.iso.datetime(),
          text: z.string(),
        }),
        z.object({
          attemptId: uuidSchema(),
          grade: writingResultSchema,
          submittedAt: z.iso.datetime(),
          text: z.string(),
        }),
      ]),
    ),
    gradesLeft: z.number().int().min(0),
    pacing: writingPacingSchema.optional(),
    question: z.string(),
    rubric: z
      .enum(["ap", "enem", "oab", "custom"])
      .meta({
        description:
          "The official rubric: ENEM, OAB, AP scoring guidelines (rows with their own points) or the item's own criteria",
      }),
    sessionId: uuidSchema(),
    status: z.enum(StudyBlockStatus),
    writing: writingPromptSchema.optional(),
  })
  .meta({ id: "Essay" }) satisfies z.ZodType<
  Omit<EssayView, "drafts"> & { drafts: (EssayView["drafts"][number] | WrittenEssayDraft)[] }
>;

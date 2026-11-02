import { MOCK_PURPOSES, MOCK_SCORINGS, mockShapeSchema } from "@zoonk/core/exams/mocks/contract";
import { type ExamMockSummary } from "@zoonk/core/exams/view/contract";
import { z } from "zod";

export const examMockSummarySchema = z
  .object({
    blockId: z
      .uuid()
      .nullable()
      .meta({
        description:
          "The id its result opens by (GET /v1/mocks/{blockId}): its session block's for a mock the plan scheduled, its own for one taken any time",
      }),
    correct: z
      .number()
      .min(0)
      .meta({ description: "Right answers, with the shares partly right answers earned" }),
    examQuestions: z
      .number()
      .int()
      .min(0)
      .nullable()
      .meta({
        description:
          "The exam's questions for what it sat, when it asked fewer (the bank had too few new ones): say how many it asked of them. Null when it asked them all",
      }),
    finishedAt: z.iso.datetime(),
    measure: z
      .number()
      .meta({ description: "The IRT score, the net score or the percent right, by scoring" }),
    number: z.number().int().min(1),
    purpose: z
      .enum(MOCK_PURPOSES)
      .meta({ description: "The plan's weekly mock, one taken any time, or placement" }),
    scoring: z.enum(MOCK_SCORINGS),
    shape: mockShapeSchema
      .nullable()
      .meta({ description: "What a mock taken any time sat; null for the plan's" }),
    total: z.number().int().min(0),
  })
  .meta({ id: "ExamMockSummary" }) satisfies z.ZodType<ExamMockSummary>;

import { MOCK_PURPOSES, mockShapeSchema } from "@zoonk/core/exams/mocks/contract";
import { type ExamMockProgress } from "@zoonk/core/exams/view/contract";
import { z } from "zod";

export const examMockProgressSchema = z
  .object({
    improved: z
      .array(z.string())
      .meta({
        description:
          "The subjects that went up the most since their first mock (by ten points or more), at most two",
      }),
    mocks: z.array(
      z.object({
        finishedAt: z.iso.datetime(),
        number: z.number().int().min(1),
        percent: z
          .number()
          .int()
          .meta({
            description:
              "Its score as a share of its questions, 0 to 100: right answers, or the net score for `net` scoring, which can fall below 0",
          }),
        purpose: z.enum(MOCK_PURPOSES),
        shape: mockShapeSchema.nullable(),
      }),
    ),
    needsWork: z
      .array(z.string())
      .meta({
        description:
          "The weakest subjects in their latest mock (below 60%), not already getting better, at most two",
      }),
    subjects: z.array(
      z.object({
        change: z
          .number()
          .int()
          .nullable()
          .meta({
            description: "Points from its first mock to its latest; null until two asked it",
          }),
        name: z.string(),
        percents: z
          .array(z.number().int())
          .meta({ description: "Its share right in each mock that asked it, oldest first" }),
      }),
    ),
  })
  .meta({ id: "ExamMockProgress" }) satisfies z.ZodType<ExamMockProgress>;

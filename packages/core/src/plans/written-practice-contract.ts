import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import {
  writingAvailabilitySchema,
  writingNeedsChoiceSchema,
  writingRangeSchema,
  writingUnitSchema,
} from "../exams/essays/writing-contract";
import { writtenPartPointsSchema } from "../exams/scoring/written-points-contract";
import { WRITTEN_CADENCES } from "./planner/plan-state";

const writtenSubjectSchema = z.object({
  answers: z.array(
    z.object({
      attemptId: uuidSchema(),
      date: z.iso.date(),
      estimatedLines: z.int().nonnegative().optional(),
      lines: z.int().positive().nullable(),
      range: writingRangeSchema.nullable(),
      taskKey: z.string(),
      title: z.string(),
      unit: writingUnitSchema.optional(),
      versions: z.int().positive(),
    }),
  ),
  availability: writingNeedsChoiceSchema.optional(),
  minutes: z.int().positive().nullable().optional(),
  points: writtenPartPointsSchema,
  questions: z.int().positive().optional(),
  share: z.number().positive().max(1).nullable().optional(),
  trend: z.array(
    z.object({
      contentShare: z.number().min(0).max(1).nullable(),
      date: z.iso.date(),
      errors: z.int().nonnegative(),
      presentationShare: z.number().min(0).max(1).nullable(),
    }),
  ),
  writeActions: z
    .array(
      z.object({
        availability: z.discriminatedUnion("status", [
          ...writingAvailabilitySchema.options,
          writingNeedsChoiceSchema,
        ]),
        blockId: uuidSchema()
          .optional()
          .describe("An unfinished extra writing block for this task"),
        taskKey: z.string(),
      }),
    )
    .optional(),
});

export const writtenPracticeSchema = z
  .object({
    cadence: z
      .enum(WRITTEN_CADENCES)
      .meta({
        description:
          "weekly (the default: spaced practice), biweekly (every other calendar week from the plan's first, and the final stretch) or finalWeeks (only the final weeks before the exam). Change it with a setWrittenCadence plan operation",
      }),
    finalWeeksFrom: z.iso
      .date()
      .nullable()
      .meta({
        description:
          "The first day of the final weeks, when that choice applies; null when the plan has no date or is all final weeks, so finalWeeks isn't offered",
      }),
    parts: z
      .array(z.string())
      .meta({ description: "The written tests, as the plan's areas name them" }),
    subjects: z.array(writtenSubjectSchema).optional(),
  })
  .meta({ id: "WrittenPractice" });

export type WrittenPractice = z.infer<typeof writtenPracticeSchema>;

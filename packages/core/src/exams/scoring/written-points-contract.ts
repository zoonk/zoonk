import { z } from "zod";
import { pointsMinimumSchema } from "../../library/exams/blueprint-contract";
import {
  writingDecimalsSchema,
  writingRangeSchema,
  writingScaleSchema,
  writingTaskSchema,
} from "../essays/writing-contract";

export const writtenPartPointsSchema = z
  .object({
    decimals: writingDecimalsSchema.optional(),
    max: z.number().positive().nullable(),
    minimum: pointsMinimumSchema.nullable(),
    name: z.string(),
    range: writingRangeSchema.nullable(),
    scale: writingScaleSchema.optional(),
    standing: z.enum(["unmeasured", "below", "overlaps", "met"]).nullable(),
    tasks: z.array(
      z.object({
        key: z.string(),
        max: z.number().positive().nullable(),
        name: z.string(),
        range: writingRangeSchema.nullable(),
        writingTask: writingTaskSchema.optional(),
      }),
    ),
  })
  .meta({ id: "WrittenPartPoints" });

export const writtenProjectionSchema = z
  .object({
    combined: writingRangeSchema.nullable(),
    max: z.number().positive().nullable(),
    objective: writingRangeSchema.nullable(),
    objectiveMax: z.number().positive().nullable(),
    parts: z.array(writtenPartPointsSchema),
  })
  .meta({ id: "WrittenProjection" });

export type WrittenProjection = z.infer<typeof writtenProjectionSchema>;

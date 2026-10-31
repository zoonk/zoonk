import { z } from "zod";
import { citedMany } from "./cited-passages";
import { questionFormatSchema } from "./extract-question-formats";

const pointsMinimumSchema = z.object({ unit: z.enum(["points", "percent"]), value: z.number() });

const markingRowSchema = z.object({
  ...citedMany,
  format: questionFormatSchema.shape.kind.nullable(),
  part: z.string().nullable(),
  points: z.number(),
  questions: z.number().int().nullable(),
  select: questionFormatSchema.shape.select,
  wrongPenalty: z.number().nullable(),
});

const scoredPartSchema = z.object({
  ...citedMany,
  maxPoints: z.number().nullable(),
  minimum: pointsMinimumSchema.nullable(),
  name: z.string(),
  qualifying: z.boolean(),
  questions: z.number().int().nullable(),
});

export const pointsScoringShape = {
  marking: z.array(markingRowSchema),
  parts: z.array(scoredPartSchema),
  totalMinimum: z.object({ ...citedMany, ...pointsMinimumSchema.shape }).nullable(),
};

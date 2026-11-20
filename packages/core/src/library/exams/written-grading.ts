import { z } from "zod";

export const citationSchema = z.object({ passage: z.string(), sourceId: z.string() });

const citedRuleSchema = z.object({ citation: citationSchema, text: z.string().min(1) });

export const writtenGradingSchema = z.object({
  criteria: z.array(
    citedRuleSchema.extend({ id: z.string().min(1), points: z.number().positive().nullable() }),
  ),
  kind: z.enum(["enem", "oab", "points", "levels"]),
  language: citedRuleSchema
    .extend({
      factor: z.number().nonnegative().nullable(),
      formula: z.string().nullable(),
      method: z.enum(["perError", "errorsPerLine", "other"]),
    })
    .nullable(),
  rounding: citedRuleSchema.nullable(),
  zeroing: z.array(citedRuleSchema),
});

export const sectionTaskSchema = z.object({
  count: z.number().int().min(1),
  description: z.string(),
  grading: writtenGradingSchema.optional(),
  handwritten: z.boolean().optional(),
  key: z.string().min(1).optional(),
  lines: z.int().positive().optional(),
  plays: z.number().int().min(1).max(2).nullable().optional(),
  points: z.number().positive().optional(),
});

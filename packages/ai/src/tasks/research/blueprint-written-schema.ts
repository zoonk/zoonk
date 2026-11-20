import { z } from "zod";
import { cited, citedMany } from "./cited-passages";

/**
 * `plays` is null for written tasks and when the notice doesn't say. It quotes every passage it
 * comes from, the line that states the task first, since a format page states a part's details in
 * separate sentences.
 */
const writtenRuleSchema = z.object({ ...cited, text: z.string() });

const writtenGradingSchema = z.object({
  criteria: z.array(writtenRuleSchema.extend({ id: z.string(), points: z.number().nullable() })),
  kind: z.enum(["enem", "oab", "points", "levels"]),
  language: writtenRuleSchema
    .extend({
      factor: z.number().nullable(),
      formula: z.string().nullable(),
      method: z.enum(["perError", "errorsPerLine", "other"]),
    })
    .nullable(),
  rounding: writtenRuleSchema.nullable(),
  zeroing: z.array(writtenRuleSchema),
});

export const writtenTaskSchema = z.object({
  ...citedMany,
  count: z.number().int(),
  description: z.string(),
  grading: writtenGradingSchema.nullable(),
  handwritten: z.boolean().nullable(),
  lines: z.int().nullable(),
  officialIdentifier: z.string().nullable(),
  plays: z.number().int().nullable(),
  points: z.number().nullable(),
});

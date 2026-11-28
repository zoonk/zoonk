import { z } from "zod";
import { citationSchema } from "./written-grading";

const readingProblemSchema = z.discriminatedUnion("kind", [
  z.object({ citation: citationSchema, kind: z.literal("missingSubject"), name: z.string() }),
  z.object({
    citation: citationSchema,
    kind: z.literal("missingCount"),
    questions: z.number().int(),
    subject: z.string(),
  }),
  z.object({ kind: z.literal("countsOffTotal"), sum: z.number().int(), total: z.number().int() }),
  z.object({
    kind: z.literal("wholeExamSubjects"),
    subjects: z.array(z.string()),
    total: z.number().int(),
  }),
  z.object({
    kind: z.literal("unconfirmed"),
    part: z.enum(["examDate", "scale", "topics"]),
    subject: z.string().nullable(),
  }),
]);

export const readingCheckSchema = z.object({
  checkedAt: z.iso.datetime(),
  problems: z.array(readingProblemSchema),
});

export type ReadingProblem = z.infer<typeof readingProblemSchema>;
export type ReadingCheck = z.infer<typeof readingCheckSchema>;

/**
 * A notice version whose reading still contradicted itself after a corrected re-read: it was never
 * saved, and only a staff re-read reads that version again.
 */
export const setAsideReadingSchema = z.object({
  checkedAt: z.iso.datetime(),
  problems: z.array(readingProblemSchema),
  sourceHash: z.string(),
});

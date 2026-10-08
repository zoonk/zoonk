import { z } from "zod";

/**
 * The last published cut-off of the learner's target, for the general list, with the page it came
 * from: where the bar was in the latest selection, never a promise. The target is a course at an
 * institution (`course`, `institution`) or a position (`position`).
 */
export const targetCutoffSchema = z
  .object({
    course: z.string().nullable(),
    edition: z
      .string()
      .nullable()
      .meta({
        description: 'The selection or edition it\'s from, as the source names it ("Sisu 2025")',
      }),
    institution: z.string().nullable(),
    position: z.string().nullable(),
    quota: z
      .string()
      .nullable()
      .meta({ description: 'The list it\'s for, as the source names it ("ampla concorrência")' }),
    score: z.number().meta({ description: "On the exam's own scale, as the source gives it" }),
    source: z.object({ title: z.string().nullable(), url: z.string() }),
  })
  .meta({ id: "TargetCutoff" });

export type TargetCutoff = z.infer<typeof targetCutoffSchema>;

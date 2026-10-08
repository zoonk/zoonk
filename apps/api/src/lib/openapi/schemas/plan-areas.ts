import { z } from "zod";

/** One of the plan's areas and how the learner shaped it, by the plan changes that do it. */
export const planAreaSchema = z.object({
  focusPart: z
    .string()
    .nullable()
    .meta({
      description:
        'The part of a focused area the learner named, such as "Biologia e Química" (`focusAreas` with `parts`); null when it\'s focused whole',
    }),
  focused: z.boolean(),
  name: z.string(),
  pastBasics: z
    .boolean()
    .meta({ description: "The learner said they're past its basics (`setAreaStart`)" }),
  reduced: z
    .boolean()
    .meta({
      description:
        "The learner wants less of it (`reduceAreas`): it keeps its core, and its depth goes to other areas first",
    }),
  skillCount: z.int(),
  skipped: z.boolean(),
});

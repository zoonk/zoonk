import { z } from "zod";

export const planAreaSchema = z.object({
  focusPart: z
    .string()
    .nullable()
    .meta({
      description:
        "The part of a focused area the learner named, such as biology and chemistry (`focusAreas` with `parts`); null when it's focused whole",
    }),
  focused: z.boolean(),
  name: z.string(),
  partOf: z
    .string()
    .nullable()
    .meta({
      description:
        "The area it's part of, for an option the exam counts inside another subject (the foreign language a candidate takes, inside ENEM's languages area): show and focus it with that area, never on its own. Null for every other area",
    }),
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

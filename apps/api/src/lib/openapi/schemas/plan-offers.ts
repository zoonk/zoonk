import { planChangeInputSchema } from "@zoonk/core/plans/contract";
import { planEffectSchema } from "@zoonk/core/plans/effect-contract";
import { z } from "zod";

const planOfferSchema = z.object({
  effect: planEffectSchema,
  fits: z
    .boolean()
    .meta({
      description:
        "True when the plan with the change covers everything in depth by its date, as the change plans it",
    }),
  operations: planChangeInputSchema.shape.operations,
});

export const planFitOfferSchema = planOfferSchema
  .extend({
    canApply: z
      .boolean()
      .meta({
        description:
          "True when `effect` was worked out for today's plan. When false the offer still stands: ask POST /v1/goals/{goalId}/plan/change-previews for today's effect before applying it",
      }),
  })
  .nullable()
  .meta({
    description:
      "The lessons the learner's own time fits by the plan's date that the plan doesn't hold, as one change (`fitLessons`) with its effect: present once every lesson is done (no system refresh adds lessons then), or once the learner's time covers everything the plan leaves out (a date moved closer, then faster study). Send `operations` to POST /v1/goals/{goalId}/plan/changes as they are. Null otherwise, and when it would add no lesson",
  });

import { planChangeInputSchema } from "@zoonk/core/plans/contract";
import { planEffectSchema } from "@zoonk/core/plans/effect-contract";
import { z } from "zod";

/** A change the Plan worked out before the learner sees it, with what it does (`PlanOffer`). */
const planOfferSchema = z.object({
  effect: planEffectSchema,
  fits: z
    .boolean()
    .meta({
      description:
        "The plan with the change covers everything in depth by its date, as the change plans it: say so (\"Your time covers everything by …\") only then",
    }),
  operations: planChangeInputSchema.shape.operations,
});

export const planFitOfferSchema = planOfferSchema
  .nullable()
  .meta({
    description:
      "The lessons the learner's own time fits by the plan's date that the plan doesn't hold, as one change (`fitLessons`) with its effect, so Apply is one tap after its diff: offered once every lesson is done (no system refresh adds lessons then), or once the learner's time covers everything the plan leaves out (a date moved closer, then faster study). Send `operations` to POST /v1/goals/{goalId}/plan/changes as they are. Never offer less daily time as covering more. Null otherwise, and when it would add no lesson",
  });

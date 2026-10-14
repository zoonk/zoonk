import { planChangeInputSchema } from "@zoonk/core/plans/contract";
import { planEffectSchema } from "@zoonk/core/plans/effect-contract";
import { z } from "zod";

/** A change the Plan worked out before the learner sees it, with what it does (`PlanOffer`). */
const planOfferSchema = z.object({
  effect: planEffectSchema,
  operations: planChangeInputSchema.shape.operations,
});

export const planFitOfferSchema = planOfferSchema
  .nullable()
  .meta({
    description:
      "The lessons the learner's own time fits by the plan's date that the plan doesn't hold, as one change (`fitLessons`) with its effect, so Apply is one tap after its diff: offered once every lesson is done (no system refresh adds lessons then), or once the learner's time covers everything the plan leaves out (a date moved closer, then faster study). Send `operations` to POST /v1/goals/{goalId}/plan/changes as they are. Never offer less daily time as covering more. Null otherwise, and when it would add no lesson",
  });

export const planPastDateOfferSchema = planOfferSchema
  .nullable()
  .meta({
    description:
      "When the plan's date came with lessons left (status `pastDate`): the one change that keeps it going, with its effect, so Apply is one tap after its diff. Send `operations` to POST /v1/goals/{goalId}/plan/changes as they are. A goal's own date moves to the day the learner's time covers what's left by (`setTargetDate`); an exam's date stays and its plan goes on after it (`setFullCourse`). Null otherwise, and when no change brings the lessons back",
  });

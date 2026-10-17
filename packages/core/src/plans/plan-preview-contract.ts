import { z } from "zod";
import { planEffectSchema } from "./plan-effect-contract";

/**
 * What a change would do to the plan, planned the way applying it plans it, with nothing saved:
 * its effect (lessons, the end, topics in or out), what the learner's time covers then, and
 * whether it would change anything at all.
 */
export const planChangePreviewSchema = z
  .object({
    effect: planEffectSchema
      .nullable()
      .meta({ description: "Null while the plan is being built (`ready` false)" }),
    feasibility: z
      .object({
        coreFits: z
          .boolean()
          .meta({ description: "Every topic (every skill's core) would be in the plan" }),
        coveredShare: z
          .number()
          .min(0)
          .max(1)
          .meta({ description: "Share of everything, in depth, covered by the plan's date" }),
        fits: z.boolean().meta({ description: "Everything would fit in depth by the plan's date" }),
        measure: z
          .enum(["exam", "goal"])
          .meta({
            description:
              "exam: a share of the exam's questions and points; goal: of the goal's skills by weight",
          }),
      })
      .nullable()
      .meta({
        description:
          "What the learner's time would cover; null while it's being built, and for a resume that keeps the plan as it is",
      }),
    ready: z
      .boolean()
      .meta({ description: "False while the plan is being built: ask again in a few seconds" }),
    unchanged: z
      .boolean()
      .meta({ description: "The change would leave the plan as it is: nothing to apply" }),
  })
  .meta({ id: "PlanChangePreview" });

export type PlanChangePreview = z.infer<typeof planChangePreviewSchema>;

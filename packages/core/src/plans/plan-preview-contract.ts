import { z } from "zod";
import { planEffectSchema } from "./plan-effect-contract";

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
    finishDate: z.iso
      .date()
      .nullable()
      .meta({
        description:
          "When the plan would finish its whole course after the change: null while it's being built, for a plan with a date (it ends on that date whatever it covers), and when the course doesn't fit in the days a plan lays out. Date a language aim's choice by this, as the time advice's `endDate` does",
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

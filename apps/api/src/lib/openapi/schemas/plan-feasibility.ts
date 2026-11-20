import { z } from "zod";

const isoDateSchema = z.iso.date();

export const planFeasibilitySchema = z.object({
  coreFits: z
    .boolean()
    .meta({
      description:
        "Every topic (every skill's core) is in the plan, the ones worth more in more depth; false only when even the cores don't fit before the deadline",
    }),
  coveredShare: z
    .number()
    .min(0)
    .max(1)
    .meta({
      description: "Share of everything, in depth, covered before the deadline (see measure)",
    }),
  deadline: isoDateSchema.nullable(),
  deepensMostAsked: z.boolean().meta({ description: "Most asked topics keep more depth" }),
  fits: z.boolean(),
  measure: z
    .enum(["exam", "goal"])
    .meta({
      description:
        "exam: a share of the exam's questions and points; goal: of the goal's skills by weight",
    }),
  reachedShare: z
    .number()
    .min(0)
    .max(1)
    .nullable()
    .meta({
      description:
        "Share whose topics this plan reaches by the deadline, including topics the learner already knows. Measured in whole percents using the same weights as coveredShare. Always 1 when every topic is reached, and at most 0.99 otherwise. Null without a deadline.",
    }),
  timeCovers: z
    .boolean()
    .meta({
      description:
        "The learner's own daily time covers everything once the plan is planned again at it, even while `fits` is false (the plan holds less than their time fits): `fitOffer` keeps their daily time. False without a deadline",
    }),
});

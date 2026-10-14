import { z } from "zod";

const isoDateSchema = z.iso.date();

/** What the learner's time covers by the goal's date, and the daily time that covers more. */
export const planFeasibilitySchema = z.object({
  alternative: z
    .object({ dailyMinutes: z.int(), endDate: isoDateSchema.nullable() })
    .nullable()
    .meta({ description: "Without a deadline: when the plan ends with more time a day" }),
  coreFits: z
    .boolean()
    .meta({
      description:
        "Every topic (every skill's core) is in the plan, the ones worth more in more depth; false only when even the cores don't fit before the deadline",
    }),
  coreMinutes: z
    .int()
    .nullable()
    .meta({
      description: "When the cores don't all fit: the daily minutes that bring every topic in",
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
  fittingDate: isoDateSchema
    .nullable()
    .meta({
      description:
        "When no daily time covers a goal that isn't an exam by its date: the earliest date the learner's time covers everything by, to move the date to with `setTargetDate`. Null otherwise",
    }),
  fullCourseEndDate: isoDateSchema
    .nullable()
    .meta({
      description:
        "When the plan leaves something out by its date: the day the learner finishes everything at their time studying it all (an exam's going on after the exam with `setFullCourse`, any other goal's without a date with `setTargetDate` null). Null when it all fits",
    }),
  maximum: z
    .object({ coveredShare: z.number().min(0).max(1), dailyMinutes: z.int() })
    .nullable()
    .meta({
      description:
        "When no daily time covers everything: the share the most daily minutes cover, when it's more",
    }),
  measure: z
    .enum(["exam", "goal"])
    .meta({
      description:
        "exam: a share of the exam's questions and points; goal: of the goal's skills by weight",
    }),
  recommendedMinutes: z
    .int()
    .nullable()
    .meta({ description: "Daily minutes that would cover everything in depth" }),
  timeCovers: z
    .boolean()
    .meta({
      description:
        "The learner's own daily time covers everything once the plan is planned again at it, even while `fits` is false (the plan holds less than their time fits): offer `fitOffer` at their time, never another daily time. Don't infer it from recommendedMinutes: more time a day can cover less (a weekly mock takes a study day). False without a deadline",
    }),
});

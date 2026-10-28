import { type PlanBasesView } from "@zoonk/core/plans/view-contract";
import { z } from "zod";

const minutesSchema = z.int().min(1);

export const planBasesSchema = z
  .object({
    daysLeft: z
      .int()
      .nullable()
      .meta({ description: "Days until the goal's date; null without one" }),
    items: z.array(
      z
        .object({
          area: z.string().meta({ description: "The plan's area, as plan changes name it" }),
          choice: z
            .enum(["deep", "essential", "quick", "skip"])
            .meta({
              description:
                "deep: every lesson of it, core and depth; essential: its core, the first third of its lessons, before what builds on it (the default); quick: one short lesson that sums it up with a worked example; skip: none of it",
            }),
          choices: z
            .array(z.enum(["deep", "essential", "quick", "skip"]))
            .meta({
              description:
                "The choices it is open to, the only ones setBaseChoices accepts for it (others are refused with baseChoiceClosed): only deep once its core is studied (studied), and only when it has more than its core; every choice otherwise. Offer only these",
            }),
          minutes: z
            .object({ deep: minutesSchema, essential: minutesSchema, quick: minutesSchema })
            .meta({ description: "What each way of studying it takes at the learner's pace" }),
          name: z.string(),
          neededFor: z
            .array(z.string())
            .meta({
              description:
                "What's built on it and worth more: an exam's notice topics, in the notice's own words, or a goal's outcome skills (its portfolio, its job search), the most valuable first",
            }),
          skillId: z.uuid(),
          studied: z
            .boolean()
            .meta({
              description:
                'The learner studied its core, none of its lessons still to do: say "Studied", and offer only deep study when choices has it',
            }),
        })
        .meta({ id: "PlanBase" }),
    ),
    knownCount: z
      .int()
      .min(0)
      .meta({
        description:
          "Bases placement or a test-out found the learner knows: they're out of the plan already. Say so",
      }),
  })
  .meta({ id: "PlanBases" }) satisfies z.ZodType<PlanBasesView>;

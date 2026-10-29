import { z } from "zod";

export const planWatchSchema = z
  .enum(["plan", "today"])
  .meta({
    description:
      "plan: the goal's plan, its items, their lessons and the courses they come from (an outline that ends), which the plan's screen shows; today: those and the learner's sessions from the last two days, their stops and the stops' lessons, which Today shows",
    id: "PlanWatch",
  });

export type PlanWatch = z.infer<typeof planWatchSchema>;

export const planChangedSinceSchema = z
  .object({
    changed: z
      .boolean()
      .meta({
        description:
          "True when something watched was written after the time asked about (or up to two seconds before it): read the plan or Today again. False: what the screen shows is still current, so ask again in a few seconds while lessons are being written",
      }),
  })
  .meta({ id: "PlanChangedSince" });

import { z } from "zod";

/**
 * What the app recommends for the plan's bases, worked out when the learner asks for it ("Get a
 * recommendation"): every lesson of each (`deep`) when their time covers everything with every
 * base in depth, else a quick lesson for each (`quick`) when the date is close and their core
 * (`essential`) further away. Exact: it plans the goal with every base in depth to say it.
 */
export const planBasesAdviceSchema = z
  .object({
    daysLeft: z
      .int()
      .nullable()
      .meta({ description: "Days until the goal's date; null without one" }),
    ready: z
      .boolean()
      .meta({ description: "False while the plan is being built: ask again in a few seconds" }),
    recommended: z
      .enum(["deep", "essential", "quick"])
      .nullable()
      .meta({
        description:
          "deep: every lesson of each base, since the learner's time covers everything with every base in depth; quick: a quick lesson for each, the date being close; essential: each base's core. Null while not ready",
      }),
  })
  .meta({ id: "PlanBasesAdvice" });

export type PlanBasesAdvice = z.infer<typeof planBasesAdviceSchema>;

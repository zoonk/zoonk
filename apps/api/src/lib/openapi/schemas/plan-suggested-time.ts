import { MAX_SUGGESTED_DAILY_MINUTES } from "@zoonk/core/plans/daily-minutes";
import { z } from "zod";

export const planSuggestedTimeSchema = z
  .object({
    kind: z
      .enum(["everything", "focus"])
      .meta({
        description:
          "everything: the minutes fit the selected curriculum by the goal's date; focus: the minutes prioritize the most important material",
      }),
    minutes: z.int().min(1).max(MAX_SUGGESTED_DAILY_MINUTES),
  })
  .nullable()
  .meta({
    description:
      "The daily time suggested for the goal while its own daily time (`schedule.dailyMinutes`) is below it: the fewest minutes that fit the selected curriculum by the goal's date, or, when that takes more than 4 hours a day, 4 hours (or the fewer minutes past which more time fits no more), which prioritize the most important material. Worked out when the plan is saved, for its own week (POST `/v1/goals/{goalId}/plan/time-to-cover` answers for another week). Null when the goal's own time covers everything or is at or above the suggestion, without a date, once the date has passed, and while the plan is being built. `setDailyMinutes` with these minutes applies it",
  });

import { z } from "zod";
import { weekdayNumberSchema } from "./weekday-number";

export const planWeekShapeSchema = z
  .object({
    canDiffer: z
      .boolean()
      .meta({
        description:
          "The plan studies on weekdays and on weekends, so the weekend can take its own time",
      }),
    weekdayDays: z
      .array(weekdayNumberSchema)
      .meta({
        description: "The weekdays from Monday to Friday the plan studies on (Sunday counted 0)",
      }),
    weekdays: z
      .int()
      .meta({
        description:
          "A study weekday's minutes: the most common among them, the longer on a tie, so one shorter day doesn't set the week's time",
      }),
    weekend: z
      .int()
      .nullable()
      .meta({ description: "The weekend's own minutes; null when it takes the weekdays' time" }),
    weekendDays: z
      .array(weekdayNumberSchema)
      .meta({ description: "The weekend days the plan studies on (Sunday counted 0)" }),
  })
  .meta({
    description:
      "How the week's study time reads in the plan editor, and which weekdays a change of the weekday or weekend time writes",
    id: "PlanWeekShape",
  });

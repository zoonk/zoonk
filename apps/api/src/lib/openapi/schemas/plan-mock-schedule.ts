import { z } from "zod";

const SUNDAY = 0;
const SATURDAY = 6;

export const planMockScheduleSchema = z
  .object({
    count: z.int().min(1).meta({ description: "Mock exams still to take" }),
    everyWeeks: z
      .int()
      .min(1)
      .nullable()
      .meta({
        description:
          "Weeks from each mock to the next, when every gap is the same; null when they differ or there is one",
      }),
    nextDate: z.iso.date(),
    weekday: z
      .int()
      .min(SUNDAY)
      .max(SATURDAY)
      .nullable()
      .meta({
        description:
          'The weekday every mock ahead falls on (Sunday 0), as in "Mock exams · Sundays"; null when they fall on different days or there is one',
      }),
  })
  .nullable()
  .meta({
    description:
      "When an exam plan's mock exams still to take fall, from their planned days: say only the pattern given (a weekday, the weeks between them), else the next date. Mocks go on the week's last study day, so study days move them. Null without one ahead",
    id: "PlanMockSchedule",
  });

import { z } from "zod";

export const courseExamDaysSchema = z
  .object({
    days: z.array(z.iso.date()).min(1),
    estimated: z.boolean(),
    timeZone: z
      .string()
      .meta({
        description:
          "IANA time zone for the exam days and countdown; UTC when the notice has no valid zone",
      }),
  })
  .meta({ id: "CourseExamDays" });

export type CourseExamDays = z.infer<typeof courseExamDaysSchema>;

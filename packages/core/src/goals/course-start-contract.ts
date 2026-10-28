import { z } from "zod";
import { ownLevelSchema } from "../learner/placement/placement-contract";
import { goalCreateInputSchema } from "./goal-contract";

export const courseGoalStartInputSchema = goalCreateInputSchema
  .pick({ studyDays: true, studyTime: true, timeZone: true })
  .extend({
    chapterId: z
      .uuid()
      .optional()
      .meta({ description: "A chapter of the course where the plan starts" }),
    dailyMinutes: goalCreateInputSchema.shape.dailyMinutes
      .optional()
      .meta({ description: "Minutes a day; 15 until the schedule screen asks" }),
    level: ownLevelSchema
      .nullable()
      .optional()
      .meta({
        description:
          "The learner's level in the course, asked before the start: null for a quick test (placement finds it). Absent, onboarding asks it",
      }),
    targetDate: z.iso
      .date()
      .nullable()
      .optional()
      .meta({
        description:
          "Optional deadline: a day after the learner's today, and at most 3,650 days after it (a later one is refused with 422 TARGET_DATE_OUT_OF_RANGE). Absent, onboarding asks for ordinary courses and exam courses use their next stored edition date when a plan reaches it. Null skips the question and sets no deadline, including exams",
      }),
  })
  .strict()
  .meta({ id: "CourseGoalStartInput" });

export type CourseGoalStartInput = z.infer<typeof courseGoalStartInputSchema>;

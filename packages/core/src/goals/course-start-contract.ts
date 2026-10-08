import { z } from "zod";
import { goalCreateInputSchema } from "./goal-contract";

/**
 * Starting a Library course as the learner's goal: nothing to type or confirm, since the course
 * says what they'll learn. A chapter starts the plan at that chapter. The learner's time can come
 * now or on onboarding's schedule screen, which asks it either way.
 */
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
  })
  .strict()
  .meta({ id: "CourseGoalStartInput" });

export type CourseGoalStartInput = z.infer<typeof courseGoalStartInputSchema>;

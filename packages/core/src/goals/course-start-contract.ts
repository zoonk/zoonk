import { z } from "zod";
import { ownLevelSchema } from "../learner/placement/placement-contract";
import { goalCreateInputSchema } from "./goal-contract";

/**
 * Starting a Library course as the learner's goal: nothing to type or confirm, since the course
 * says what they'll learn. A chapter starts the plan at that chapter. The learner's level comes
 * from the start page, so nothing exists before they answer it; their time can come now or on
 * onboarding's schedule screen, which asks it either way. A date may come from the start page;
 * otherwise onboarding asks it, or a linked public exam supplies its next notice date.
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

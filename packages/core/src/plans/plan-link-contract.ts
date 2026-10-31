import { type GoalKind } from "@zoonk/db";
import { z } from "zod";
import { dailyMinutesSchema, goalCreateInputSchema } from "../goals/goal-contract";
import { type PlanPhaseKind } from "./planner/plan-state";

const MAX_TITLE_LENGTH = 120;

/** The owner's goal, answers and progress are never copied, only the plan's structure. */
export const planLinkStartInputSchema = goalCreateInputSchema
  .pick({ dailyMinutes: true, studyDays: true, studyTime: true, timeZone: true })
  .extend({
    dailyMinutes: dailyMinutesSchema
      .optional()
      .meta({
        description:
          "The time a day the learner chose, which answers setup's time question. Without it the plan starts on 15 minutes a day and setup asks",
      }),
    targetDate: z.iso
      .date()
      .optional()
      .meta({
        description:
          "The learner's own date, if any: a day after their today, and at most 3,650 days after it (a later one is refused with 422 TARGET_DATE_OUT_OF_RANGE)",
      }),
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
  })
  .strict()
  .meta({ id: "PlanLinkStartInput" });

export type PlanLinkStartInput = z.infer<typeof planLinkStartInputSchema>;

/** Never who made it, their dates, pace, answers or progress. */
export type PlanLinkOutline = {
  subject: { description: string | null; title: string } | null;
  goalKind: GoalKind;
  hours: number;
  language: string;
  /** Exam phases have no name: apps name them by `kind`, as the plan does. */
  phases: { hours: number; kind: PlanPhaseKind; milestone: string | null; name: string }[];
  skillCount: number;
  targetLanguage: string | null;
};

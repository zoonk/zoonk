import { type GoalKind } from "@zoonk/db";
import { z } from "zod";
import { goalCreateInputSchema } from "../goals/goal-contract";
import { type PlanPhaseKind } from "./planner/plan-state";

const MAX_TITLE_LENGTH = 120;

/**
 * Starting a plan from someone's link: the learner's own time, and a title when the link's subject
 * has none. The owner's goal, answers and progress are never copied, only the plan's structure.
 */
export const planLinkStartInputSchema = goalCreateInputSchema
  .pick({ dailyMinutes: true, studyDays: true, studyTime: true, timeZone: true })
  .extend({
    targetDate: z.iso.date().optional().meta({ description: "The learner's own date, if any" }),
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
  })
  .strict()
  .meta({ id: "PlanLinkStartInput" });

export type PlanLinkStartInput = z.infer<typeof planLinkStartInputSchema>;

/**
 * What anyone with a plan's link sees: the subject and the plan's shape, never who made it, their
 * dates, pace, answers or progress.
 */
export type PlanLinkOutline = {
  /** The subject's public course or exam, used as the page's title and preview. */
  subject: { description: string | null; title: string } | null;
  goalKind: GoalKind;
  /** Study time the plan's lessons take, from the plan's size rather than the owner's pace. */
  hours: number;
  language: string;
  /** Exam phases have no name: apps name them by `kind`, as the plan does. */
  phases: { hours: number; kind: PlanPhaseKind; milestone: string | null; name: string }[];
  skillCount: number;
  targetLanguage: string | null;
};

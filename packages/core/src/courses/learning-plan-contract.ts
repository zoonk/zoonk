import { type CourseLevel, type CoursePlanDepth } from "@zoonk/db";
import { z } from "zod";

const MINUTES_PER_DAY = 1440;
const MAX_PLAN_TEXT_LENGTH = 4000;

export const CURRENT_CURRICULUM_VERSION = 2;

export const CORE_COURSE_LEVELS = ["overview", "basic", "intermediate", "advanced"] as const;
export const LANGUAGE_COURSE_LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"] as const;
export const OPTIONAL_LESSON_KINDS = ["quiz", "practice", "review"] as const;
const COURSE_LEVELS = [
  ...CORE_COURSE_LEVELS,
  ...LANGUAGE_COURSE_LEVELS,
] as const satisfies readonly CourseLevel[];

const COURSE_PLAN_DEPTHS = [
  "overview",
  "complete",
  "focused",
] as const satisfies readonly CoursePlanDepth[];

export const coursePlanInputSchema = z
  .object({
    dailyMinutes: z.number().int().positive().max(MINUTES_PER_DAY).nullable().optional(),
    depth: z.enum(COURSE_PLAN_DEPTHS),
    goal: z.string().trim().max(MAX_PLAN_TEXT_LENGTH).nullable().optional(),
    hiddenLessonKinds: z
      .array(
        z.enum([
          "alphabet",
          "custom",
          "explanation",
          "grammar",
          "listening",
          "practice",
          "quiz",
          "reading",
          "review",
          "translation",
          "tutorial",
          "vocabulary",
        ]),
      )
      .optional(),
    startingKnowledge: z.string().trim().max(MAX_PLAN_TEXT_LENGTH).nullable().optional(),
    startingLevel: z.enum(COURSE_LEVELS).nullable().optional(),
  })
  .strict();

export type CoursePlanInput = z.infer<typeof coursePlanInputSchema>;

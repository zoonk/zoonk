import { GoalKind } from "@zoonk/db";
import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { z } from "zod";
import { DAYS_PER_WEEK, MAX_DAILY_MINUTES, MIN_DAILY_MINUTES } from "../plans/planner/plan-state";

const MAX_TITLE_LENGTH = 120;
const MAX_PROMPT_LENGTH = 2000;
const MAX_GOALS_AT_ONCE = 3;
/** Files or notes attached to a typed goal; more is better added from the goal later. */
const MAX_GOAL_SOURCES = 5;
const MIN_LANGUAGE_LENGTH = 2;
const MAX_LANGUAGE_LENGTH = 10;
const STUDY_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

const languageSchema = z.string().min(MIN_LANGUAGE_LENGTH).max(MAX_LANGUAGE_LENGTH);

const dailyMinutesSchema = z
  .int()
  .min(MIN_DAILY_MINUTES)
  .max(MAX_DAILY_MINUTES)
  .meta({ description: "Minutes a day for this goal" });

const studyDaysSchema = z
  .array(
    z
      .int()
      .min(0)
      .max(DAYS_PER_WEEK - 1),
  )
  .min(1)
  .max(DAYS_PER_WEEK)
  .meta({
    description:
      "Weekdays the learner studies, Sunday (0) to Saturday (6); every day when left out",
  });

const studyTimeSchema = z
  .string()
  .regex(STUDY_TIME_PATTERN)
  .meta({ description: 'Preferred local study time, such as "20:00"' });

const timeZoneSchema = z
  .string()
  .refine(isValidTimeZone, { message: "Invalid timezone" })
  .meta({ description: "The learner's IANA timezone" });

const detailsSchema = z
  .record(z.string(), z.json())
  .meta({
    description:
      "What onboarding understood: exam, date, target score, course or position, level, reason, purpose, role",
  });

export const goalDraftSchema = z
  .object({
    dailyMinutes: dailyMinutesSchema.optional(),
    details: detailsSchema.optional(),
    examBlueprintId: z.uuid().optional(),
    kind: z.enum(GoalKind),
    language: languageSchema.meta({ description: "The language the learner studies in" }),
    primaryCourseId: z.uuid().optional(),
    prompt: z
      .string()
      .trim()
      .min(1)
      .max(MAX_PROMPT_LENGTH)
      .meta({ description: "What the learner typed" }),
    targetDate: z.iso.date().optional(),
    targetLanguage: languageSchema.optional().meta({ description: "The language being learned" }),
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
  })
  .strict()
  .refine((goal) => goal.kind !== "language" || goal.targetLanguage !== undefined, {
    message: "Language goals need a target language",
    path: ["targetLanguage"],
  })
  .meta({ id: "GoalDraft" });

/**
 * One or more goals from onboarding. "ENEM and English" becomes two goals that share the daily
 * minutes, the first as the main one, unless a goal sets its own minutes.
 */
export const goalCreateInputSchema = z
  .object({
    dailyMinutes: dailyMinutesSchema.meta({
      description: "The day's time, shared by the new goals",
    }),
    goals: z.array(goalDraftSchema).min(1).max(MAX_GOALS_AT_ONCE),
    sourceIds: z
      .array(z.uuid())
      .max(MAX_GOAL_SOURCES)
      .optional()
      .meta({
        description:
          "Material the learner uploaded with the goal (`POST /v1/uploads`), linked to the main goal so its research and curriculum read it",
      }),
    studyDays: studyDaysSchema.optional(),
    studyTime: studyTimeSchema.optional(),
    timeZone: timeZoneSchema.optional(),
  })
  .strict()
  .meta({ id: "GoalCreateInput" });

export type GoalCreateInput = z.infer<typeof goalCreateInputSchema>;
export type GoalDraft = z.infer<typeof goalDraftSchema>;

/** Every field is optional, so each screen sends only what changed. */
export const goalUpdateInputSchema = z
  .object({
    dailyMinutes: dailyMinutesSchema.optional(),
    details: detailsSchema.optional(),
    status: z
      .enum(["active", "paused", "archived", "completed"])
      .optional()
      .meta({ description: "Pause, resume, archive or complete the goal" }),
    studyDays: studyDaysSchema.optional(),
    studyTime: studyTimeSchema.nullable().optional(),
    targetDate: z.iso.date().nullable().optional(),
    timeZone: timeZoneSchema.optional(),
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
  })
  .strict()
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: "At least one field must be provided",
  })
  .meta({ id: "GoalUpdateInput", override: { minProperties: 1 } });

export type GoalUpdateInput = z.infer<typeof goalUpdateInputSchema>;

/** A goal as every screen and the API show it. */
export type GoalView = {
  createdAt: string;
  dailyMinutes: number;
  details: Record<string, unknown>;
  examBlueprintId: string | null;
  id: string;
  isActive: boolean;
  kind: GoalKind;
  language: string;
  plan: {
    /** False until the planner has written the plan's phases. */
    ready: boolean;
    currentPhase: number | null;
    endDate: string | null;
    lessonsDone: number;
    lessonsTotal: number;
    phaseCount: number;
  } | null;
  primaryCourseId: string | null;
  prompt: string;
  status: "active" | "archived" | "completed" | "paused";
  studyDays: number[];
  studyTime: string | null;
  targetDate: string | null;
  targetLanguage: string | null;
  timezone: string | null;
  title: string;
};

import { GoalKind } from "@zoonk/db";
import {
  type RegionChoice,
  isLanguageRegion,
  splitTargetLanguage,
} from "@zoonk/utils/language-regions";
import { LANGUAGE_CODE_PATTERN, toCanonicalLanguage } from "@zoonk/utils/languages";
import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { MAX_DAILY_MINUTES, MIN_DAILY_MINUTES } from "../plans/daily-minutes";
import { DAYS_PER_WEEK } from "../plans/planner/plan-state";
import {
  MAX_GOAL_DETAILS_LENGTH,
  MAX_GOAL_PROMPT_LENGTH,
  MAX_GOAL_TITLE_LENGTH,
} from "./goal-input-limits";

const MAX_GOALS_AT_ONCE = 3;
const MAX_GOAL_SOURCES = 5;
const MAX_LANGUAGE_LENGTH = 10;
const STUDY_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

const languageTagSchema = z
  .string()
  .max(MAX_LANGUAGE_LENGTH)
  .regex(LANGUAGE_CODE_PATTERN, { abort: true });

const languageSchema = languageTagSchema.overwrite((language) => toCanonicalLanguage(language));

export const targetRegionSchema = z.string().regex(/^[A-Z]{2}$/u);

export const regionChoiceSchema = z
  .object({
    code: z.string(),
    name: z.string().meta({ description: "The country's name in the goal's language" }),
    taught: z
      .boolean()
      .meta({ description: "The country whose variety lessons and their audio teach" }),
  })
  .meta({ id: "RegionChoice" }) satisfies z.ZodType<RegionChoice>;

export const dailyMinutesSchema = z
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

/**
 * Only core writes these: research the notice's question formats, which shared questions read,
 * and the level test its progress and result, which set the learner's skill levels.
 */
const CORE_DETAILS_KEYS: ReadonlySet<string> = new Set([
  "levelTest",
  "noticeFormats",
  "skillLevels",
]);

function isCoreDetail([key]: [string, unknown]): boolean {
  return CORE_DETAILS_KEYS.has(key);
}

export function withoutCoreDetails<Value>(details: Record<string, Value>): Record<string, Value> {
  return Object.fromEntries(Object.entries(details).filter((entry) => !isCoreDetail(entry)));
}

export function onlyCoreDetails<Value>(details: Record<string, Value>): Record<string, Value> {
  return Object.fromEntries(Object.entries(details).filter((entry) => isCoreDetail(entry)));
}

const detailsSchema = z
  .record(z.string(), z.json())
  .overwrite((details) => withoutCoreDetails(details))
  .refine((details) => JSON.stringify(details).length <= MAX_GOAL_DETAILS_LENGTH, {
    message: `Details are at most ${MAX_GOAL_DETAILS_LENGTH} characters as JSON`,
  })
  .meta({
    description: `What onboarding understood: exam, date, target score, course or position, level, reason, purpose, role. At most ${MAX_GOAL_DETAILS_LENGTH} characters as JSON`,
  });

type DraftLanguage = { kind: GoalKind; targetLanguage?: string; targetRegion?: string };

function isDraftRegion({ kind, targetLanguage, targetRegion }: DraftLanguage): boolean {
  if (kind !== "language" || !targetLanguage || !targetRegion) {
    return false;
  }

  const written = new Intl.Locale(targetLanguage).region;
  const { targetLanguage: language } = splitTargetLanguage(targetLanguage);

  return (
    (!written || written === targetRegion) && isLanguageRegion({ language, region: targetRegion })
  );
}

function withTargetRegion<Draft extends DraftLanguage>(goal: Draft): Draft {
  if (!goal.targetLanguage) {
    return goal;
  }

  const { targetLanguage, targetRegion } = splitTargetLanguage(goal.targetLanguage);
  const region = goal.targetRegion ?? (goal.kind === "language" ? targetRegion : null);

  return { ...goal, targetLanguage, ...(region && { targetRegion: region }) };
}

export const goalDraftSchema = z
  .object({
    dailyMinutes: dailyMinutesSchema.optional(),
    details: detailsSchema.optional(),
    displayName: z.string().trim().min(1).optional(),
    examBlueprintId: uuidSchema().optional(),
    kind: z.enum(GoalKind),
    language: languageSchema.meta({ description: "The language the learner studies in" }),
    primaryCourseId: uuidSchema().optional(),
    prompt: z
      .string()
      .trim()
      .min(1)
      .max(MAX_GOAL_PROMPT_LENGTH)
      .meta({ description: "What the learner typed" }),
    targetDate: z.iso
      .date()
      .optional()
      .meta({
        description:
          "A new goal's deadline: from tomorrow through calendar day 3,650 after the learner's today, inclusive. A date outside either bound is refused with 422 TARGET_DATE_OUT_OF_RANGE before any goal is created, except on a goal from an onboarding card (`details.onboardingId`): a card's date can stop being ahead after the card was read, so that goal starts without it and its setup asks for one.",
      }),
    targetLanguage: languageTagSchema
      .optional()
      .meta({
        description:
          "The language being learned. A tag with one of the language's countries (`es-AR`) is stored as the language (`es`) with that `targetRegion`",
      }),
    targetRegion: targetRegionSchema
      .optional()
      .meta({
        description:
          "A language goal's country, as an ISO 3166-1 alpha-2 code: the buddy and practice calls use its variety, while lessons and their audio stay those of the language. One the language doesn't list, or that contradicts the country in `targetLanguage`, is refused as invalid",
      }),
    title: z.string().trim().min(1).max(MAX_GOAL_TITLE_LENGTH),
  })
  .strict()
  .refine((goal) => goal.kind !== "language" || goal.targetLanguage !== undefined, {
    message: "Language goals need a target language",
    path: ["targetLanguage"],
  })
  .refine((goal) => !goal.targetRegion || isDraftRegion(goal), {
    message: "A country must be one of a language goal's countries and agree with its tag",
    path: ["targetRegion"],
  })
  .overwrite((goal) => withTargetRegion(goal))
  .meta({ id: "GoalDraft" });

export const goalCreateInputSchema = z
  .object({
    dailyMinutes: dailyMinutesSchema.meta({
      description: "The day's time, shared by the new goals",
    }),
    goals: z.array(goalDraftSchema).min(1).max(MAX_GOALS_AT_ONCE),
    sourceIds: z
      .array(uuidSchema())
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

export const goalUpdateInputSchema = z
  .object({
    dailyMinutes: dailyMinutesSchema.optional(),
    details: detailsSchema.optional(),
    displayName: z.string().trim().min(1).max(MAX_GOAL_TITLE_LENGTH).optional(),
    status: z
      .enum(["active", "paused", "archived", "completed"])
      .optional()
      .meta({ description: "Pause, resume, archive or complete the goal" }),
    studyDays: studyDaysSchema.optional(),
    studyTime: studyTimeSchema.nullable().optional(),
    targetDate: z.iso
      .date()
      .nullable()
      .optional()
      .meta({
        description:
          "The goal's new deadline, or null for none: after the learner's today (an earlier one is refused with 422 PLAN_CHANGE_INVALID `pastDate`) and at most 3,650 days after it (a later one with 422 TARGET_DATE_OUT_OF_RANGE). The goal's current date, even a passed one, can be sent again",
      }),
    targetRegion: targetRegionSchema
      .nullable()
      .optional()
      .meta({
        description:
          "A language goal's country from its `regionChoices`, or null for none. Lessons and the plan don't change. Another country, or one on a goal that isn't a language goal, is refused with 422 TARGET_REGION_NOT_OFFERED",
      }),
    timeZone: timeZoneSchema.optional(),
    title: z.string().trim().min(1).max(MAX_GOAL_TITLE_LENGTH).optional(),
    weekendMinutes: dailyMinutesSchema
      .optional()
      .meta({
        description:
          "Minutes on Saturday and Sunday when they differ from the daily time; only study days take them",
      }),
  })
  .strict()
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: "At least one field must be provided",
  })
  .meta({ id: "GoalUpdateInput", override: { minProperties: 1 } });

export type GoalUpdateInput = z.infer<typeof goalUpdateInputSchema>;

export type GoalView = {
  displayName: string;
  createdAt: string;
  dailyMinutes: number;
  details: Record<string, unknown>;
  examBlueprintId: string | null;
  id: string;
  isActive: boolean;
  kind: GoalKind;
  language: string;
  /** A `flag-icons` code: the goal's country's flag, else its language's; null without one. */
  languageFlag: string | null;
  plan: {
    /** False until the planner has written the plan's phases. */
    ready: boolean;
    currentPhase: number | null;
    endDate: string | null;
    lessonsDone: number;
    /** Every lesson the plan teaches but those tested out. */
    lessonsTotal: number;
    phaseCount: number;
  } | null;
  primaryCourseId: string | null;
  prompt: string;
  /** The countries a language goal can pick, named in its language; empty for other goals. */
  regionChoices: RegionChoice[];
  status: "active" | "archived" | "completed" | "paused";
  studyDays: number[];
  studyTime: string | null;
  targetDate: string | null;
  targetLanguage: string | null;
  /** Set only when the learner asked for a country. */
  targetRegion: string | null;
  timezone: string | null;
  title: string;
};

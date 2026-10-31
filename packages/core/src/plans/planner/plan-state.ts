import { CourseLevel } from "@zoonk/db/enums";
import { z } from "zod";
import { examChoicePickSchema } from "../../exams/choices/exam-choice-contract";
import { LANGUAGE_ACTIVITY_TYPES } from "../../language/activities/language-activities";
import { challengeTeamSchema } from "../../library/challenges/challenge-team";
import { MAX_DAILY_MINUTES } from "../daily-minutes";
import { TOOL_CHOICES, TOOL_SYSTEMS } from "../plan-tools-contract";

const PLAN_PHASE_KINDS = [
  "learn",
  "foundations",
  "gaps",
  "practice",
  "finalStretch",
  "afterExam",
] as const;

export const PRACTICE_BIASES = ["moreExplanation", "balanced", "morePractice"] as const;
export const DIFFICULTY_BIASES = ["easier", "standard", "harder"] as const;
export const AREA_STARTS = ["pastBasics", "basics"] as const;
const PACE_SOURCES = ["own", "course", "typical"] as const;

export const WRITTEN_CADENCES = ["weekly", "biweekly", "finalWeeks"] as const;

export const BASE_CHOICES = ["deep", "essential", "quick", "skip"] as const;

export type BaseChoice = (typeof BASE_CHOICES)[number];
export type PlanPhaseKind = (typeof PLAN_PHASE_KINDS)[number];
export type PracticeBias = (typeof PRACTICE_BIASES)[number];
export type DifficultyBias = (typeof DIFFICULTY_BIASES)[number];
export type WrittenCadence = (typeof WRITTEN_CADENCES)[number];
export type PaceSource = (typeof PACE_SOURCES)[number];

export const DAYS_PER_WEEK = 7;

const isoDateSchema = z.iso.date();

const graphPhaseSchema = z.object({
  milestone: z.string().nullable().default(null),
  name: z.string(),
});

/** `weight` is the exam weight, 1 to 5, or null. */
const graphSkillSchema = z.object({
  area: z.string().nullable().default(null),
  courseIds: z.array(z.string()).optional(),
  lessons: z.int().min(1),
  name: z.string(),
  outcome: z.boolean().optional(),
  outlined: z.boolean().optional(),
  phase: z.int().min(0),
  plannedLessons: z.int().min(0).optional(),
  skillId: z.string(),
  /** The source's topic texts exactly, so the syllabus can tick each one; absent when unknown. */
  topics: z.array(z.string()).optional(),
  weight: z.number().nullable().default(null),
});

const optionSkillSchema = graphSkillSchema.extend({ after: z.string().nullable().default(null) });

export const planGraphSchema = z.object({
  courseOutline: z
    .object({
      courseId: z.string(),
      levels: z.array(z.enum(CourseLevel)),
      startChapterId: z.string().nullable(),
    })
    .optional(),
  optionSkills: z.array(optionSkillSchema).optional(),
  phases: z.array(graphPhaseSchema).default([]),
  skills: z.array(graphSkillSchema).default([]),
});

const lightWeekSchema = z.object({ endDate: isoDateSchema, startDate: isoDateSchema });

const movedEventSchema = z.object({ from: isoDateSchema, to: isoDateSchema });

const mockFundingSchema = z.object({
  contributions: z.array(z.object({ date: isoDateSchema, minutes: z.number().positive() })),
  date: isoDateSchema,
  day: z.number().int().nullable().optional(),
  fullLength: z.boolean().optional(),
  minutes: z.number().positive(),
});

const focusPartSchema = z.object({
  area: z.string(),
  name: z.string(),
  skillIds: z.array(z.string()).min(1),
});

export const toolChoiceSchema = z.object({
  choice: z.enum(TOOL_CHOICES),
  name: z.string(),
  setupSkillId: z.string().nullable().default(null),
  system: z.enum(TOOL_SYSTEMS).nullable().default(null),
});

const baseChoiceSchema = z.object({
  choice: z.enum(BASE_CHOICES).exclude(["essential"]),
  skillId: z.string(),
});

/** `weekdayMinutes` is Sunday first, 0 for rest days; null gives every day the daily minutes. */
const planSettingsSchema = z.object({
  baseChoices: z.array(baseChoiceSchema).default([]),
  checkpointOverflow: z
    .array(z.object({ date: isoDateSchema, minutes: z.number().positive() }))
    .default([]),
  difficultyBias: z.enum(DIFFICULTY_BIASES).default("standard"),
  examChoices: z.array(examChoicePickSchema).default([]),
  focusAreas: z.array(z.string()).default([]),
  focusParts: z.array(focusPartSchema).default([]),
  fullCourse: z.boolean().default(false),
  lightWeeks: z.array(lightWeekSchema).default([]),
  mockFunding: z.array(mockFundingSchema).default([]),
  movedEvents: z.array(movedEventSchema).default([]),
  noticeDate: isoDateSchema.nullable().default(null),
  pace: z
    .object({ factor: z.number().positive(), source: z.enum(PACE_SOURCES) })
    .nullable()
    .default(null),
  pastBasicsAreas: z.array(z.string()).default([]),
  practiceBias: z.enum(PRACTICE_BIASES).default("balanced"),
  reducedAreas: z.array(z.string()).default([]),
  shortMockMinutes: z.number().positive().nullable().default(null),
  skippedActivities: z.array(z.enum(LANGUAGE_ACTIVITY_TYPES)).default([]),
  skippedAreas: z.array(z.string()).default([]),
  startDate: isoDateSchema.nullable().default(null),
  team: challengeTeamSchema.nullable().default(null),
  tools: z.array(toolChoiceSchema).default([]),
  weekdayMinutes: z
    .array(z.int().min(0).max(MAX_DAILY_MINUTES))
    .length(DAYS_PER_WEEK)
    .nullable()
    .default(null),
  writtenCadence: z.enum(WRITTEN_CADENCES).default("weekly"),
});

const planPhaseSchema = z.object({
  /** Its challenge has no room before the date; a phase with nothing to study has none at all. */
  challengeLeftOut: z.boolean().optional(),
  endDate: isoDateSchema.nullable().default(null),
  kind: z.enum(PLAN_PHASE_KINDS).default("learn"),
  milestone: z.string().nullable().default(null),
  minutes: z.number().min(0).default(0),
  name: z.string().default(""),
  startDate: isoDateSchema.nullable().default(null),
});

export type PlanGraph = z.infer<typeof planGraphSchema>;
export type PlanGraphSkill = PlanGraph["skills"][number];
export type PlanOptionSkill = NonNullable<PlanGraph["optionSkills"]>[number];
export type PlanSettings = z.infer<typeof planSettingsSchema>;
export type PlanPhase = z.infer<typeof planPhaseSchema>;
export type LightWeek = z.infer<typeof lightWeekSchema>;
export type MovedEvent = z.infer<typeof movedEventSchema>;
export type FocusPart = z.infer<typeof focusPartSchema>;
export type PlanToolChoice = z.infer<typeof toolChoiceSchema>;
export type StoredBaseChoice = z.infer<typeof baseChoiceSchema>;

export const planStateSchema = z.object({
  goal: z.object({ dailyMinutes: z.int(), targetDate: isoDateSchema.nullable() }),
  graph: planGraphSchema,
  settings: planSettingsSchema,
});

export type PlanState = z.infer<typeof planStateSchema>;

function parseOr<T>({
  fallback,
  schema,
  value,
}: {
  fallback: T;
  schema: z.ZodType<T>;
  value: unknown;
}) {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

export function parsePlanGraph(value: unknown): PlanGraph {
  return parseOr({ fallback: { phases: [], skills: [] }, schema: planGraphSchema, value });
}

export function parsePlanSettings(value: unknown): PlanSettings {
  return parseOr({ fallback: planSettingsSchema.parse({}), schema: planSettingsSchema, value });
}

export function parsePlanPhases(value: unknown): PlanPhase[] {
  return parseOr({ fallback: [], schema: z.array(planPhaseSchema), value });
}

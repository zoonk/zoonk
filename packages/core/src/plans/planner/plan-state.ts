import { z } from "zod";
import { LANGUAGE_ACTIVITY_TYPES } from "../../language/activities/language-activities";
import { challengeTeamSchema } from "../../library/challenges/challenge-team";
import { TOOL_CHOICES, TOOL_SYSTEMS } from "../plan-tools-contract";

/** Learn phases come from the skill graph; exam plans with a date use time-boxed phases instead. */
const PLAN_PHASE_KINDS = ["learn", "foundations", "gaps", "practice", "finalStretch"] as const;

export const PRACTICE_BIASES = ["moreExplanation", "balanced", "morePractice"] as const;
export const DIFFICULTY_BIASES = ["easier", "standard", "harder"] as const;
/** Where an area starts: past its foundations, or from them (the default). */
export const AREA_STARTS = ["pastBasics", "basics"] as const;
const PACE_SOURCES = ["own", "course", "typical"] as const;

/**
 * When an exam's written tests (a redação, a discursive test) are practiced: a little every week
 * (the default: spaced practice with feedback improves writing most), every other week, or only
 * in the final weeks before the exam. The total practice stays the same; only when it comes moves.
 */
export const WRITTEN_CADENCES = ["weekly", "biweekly", "finalWeeks"] as const;

export type PlanPhaseKind = (typeof PLAN_PHASE_KINDS)[number];
export type PracticeBias = (typeof PRACTICE_BIASES)[number];
export type DifficultyBias = (typeof DIFFICULTY_BIASES)[number];
export type WrittenCadence = (typeof WRITTEN_CADENCES)[number];
export type PaceSource = (typeof PACE_SOURCES)[number];

export const MIN_DAILY_MINUTES = 5;
export const MAX_DAILY_MINUTES = 240;
export const DAYS_PER_WEEK = 7;

const isoDateSchema = z.iso.date();

/** One phase of the skill graph, as the graph task wrote it. */
const graphPhaseSchema = z.object({
  milestone: z.string().nullable().default(null),
  name: z.string(),
});

/**
 * One skill the goal needs. `lessons` is the graph's size estimate, used until the Library has the
 * skill's lessons; `weight` is the exam weight (1 to 5) or null; `area` groups skills for "focus on
 * math" edits (the course the skill belongs to).
 */
const graphSkillSchema = z.object({
  area: z.string().nullable().default(null),
  /**
   * The Library courses the goal learns this skill in. Skills are shared across courses, so the
   * planner takes the skill's lessons only from these courses' chapters: another subject's lessons
   * for the same skill teach other content. Without them (setup skills, prerequisites a change
   * added, plans made before courses were known) the lessons come from any course.
   */
  courseIds: z.array(z.string()).optional(),
  lessons: z.int().min(1),
  name: z.string(),
  /**
   * The skill turns what the learner studied into the goal's result (a career change's portfolio
   * and job search): a plan short on time keeps it whole and leaves out other skills' depth first.
   */
  outcome: z.boolean().optional(),
  phase: z.int().min(0),
  skillId: z.string(),
  /**
   * The exact texts of the source's topics this skill teaches (for an exam, its notice's
   * `structure.subjects[].topics`), so the syllabus can tick each topic. Absent on older graphs.
   */
  topics: z.array(z.string()).optional(),
  weight: z.number().nullable().default(null),
});

/** The goal's skill graph in teaching order: prerequisites always come first. */
export const planGraphSchema = z.object({
  phases: z.array(graphPhaseSchema).default([]),
  skills: z.array(graphSkillSchema).default([]),
});

const lightWeekSchema = z.object({ endDate: isoDateSchema, startDate: isoDateSchema });

/** A weekly checkpoint or mock the learner moved to a later day ("Move to Monday"). */
const movedEventSchema = z.object({ from: isoDateSchema, to: isoDateSchema });

/**
 * The part of a focused area the learner named ("mais biologia e química" in ENEM's Ciências da
 * Natureza, which also holds physics): only these skills of the area get the focus, under the
 * name the learner would say.
 */
const focusPartSchema = z.object({
  area: z.string(),
  name: z.string(),
  skillIds: z.array(z.string()).min(1),
});

/**
 * The learner's choice for one tool, by the name the plan's chapters give it. `setupSkillId` is
 * the setup lesson's skill this choice added to the graph, so a later choice takes it back out.
 */
export const toolChoiceSchema = z.object({
  choice: z.enum(TOOL_CHOICES),
  name: z.string(),
  setupSkillId: z.string().nullable().default(null),
  system: z.enum(TOOL_SYSTEMS).nullable().default(null),
});

/**
 * How the learner shaped the plan. `weekdayMinutes` (Sunday first) overrides the goal's daily
 * minutes per weekday, with 0 for rest days; null means every day gets the daily minutes.
 */
const planSettingsSchema = z.object({
  difficultyBias: z.enum(DIFFICULTY_BIASES).default("standard"),
  focusAreas: z.array(z.string()).default([]),
  /** Focused areas narrowed to the part the learner named; an area without one is focused whole. */
  focusParts: z.array(focusPartSchema).default([]),
  lightWeeks: z.array(lightWeekSchema).default([]),
  movedEvents: z.array(movedEventSchema).default([]),
  /**
   * The exam day the plan took from the exam's notice, or its estimate, when the learner gave no
   * date. While the goal's date is this day it's the notice's, so a new day from the notice (an
   * estimate too) replaces it as a change the learner applies; a date the learner set is theirs.
   */
  noticeDate: isoDateSchema.nullable().default(null),
  pace: z
    .object({ factor: z.number().positive(), source: z.enum(PACE_SOURCES) })
    .nullable()
    .default(null),
  /**
   * Areas the learner said they're past the basics of ("the English lessons are too basic"): they
   * start past their foundations, at their higher Library bands, whatever placement found.
   */
  pastBasicsAreas: z.array(z.string()).default([]),
  practiceBias: z.enum(PRACTICE_BIASES).default("balanced"),
  /**
   * Areas the learner wants less of but keeps ("menos Filosofia"): they count half, so their depth
   * and their share of the days go to the others first. A focus on one of them takes it back out.
   */
  reducedAreas: z.array(z.string()).default([]),
  /**
   * A class test's own mock at full length, which rehearses it the day before when the test is days
   * away. Null for exams whose mock is a whole exam day. The planner sets it from the exam, like
   * the pace, so the day's minutes read the same in the plan and in sessions.
   */
  shortMockMinutes: z.number().positive().nullable().default(null),
  /** Language practice the learner left out ("I don't need writing"), until they bring it back. */
  skippedActivities: z.array(z.enum(LANGUAGE_ACTIVITY_TYPES)).default([]),
  skippedAreas: z.array(z.string()).default([]),
  /** The plan's first day; exam phases are measured from it, so they don't move every day. */
  startDate: isoDateSchema.nullable().default(null),
  /** The colleagues in this plan's challenges, picked when the first one is played. */
  team: challengeTeamSchema.nullable().default(null),
  /** What the learner said about each tool on the "You'll use" card. */
  tools: z.array(toolChoiceSchema).default([]),
  weekdayMinutes: z
    .array(z.int().min(0).max(MAX_DAILY_MINUTES))
    .length(DAYS_PER_WEEK)
    .nullable()
    .default(null),
  /** When an exam's written tests are practiced (see `WRITTEN_CADENCES`). */
  writtenCadence: z.enum(WRITTEN_CADENCES).default("weekly"),
});

/** A phase as the learner sees it, with the dates the last planning run gave it. */
const planPhaseSchema = z.object({
  endDate: isoDateSchema.nullable().default(null),
  kind: z.enum(PLAN_PHASE_KINDS).default("learn"),
  milestone: z.string().nullable().default(null),
  minutes: z.number().min(0).default(0),
  name: z.string().default(""),
  startDate: isoDateSchema.nullable().default(null),
});

export type PlanGraph = z.infer<typeof planGraphSchema>;
export type PlanGraphSkill = PlanGraph["skills"][number];
export type PlanSettings = z.infer<typeof planSettingsSchema>;
export type PlanPhase = z.infer<typeof planPhaseSchema>;
export type LightWeek = z.infer<typeof lightWeekSchema>;
export type MovedEvent = z.infer<typeof movedEventSchema>;
export type FocusPart = z.infer<typeof focusPartSchema>;
export type PlanToolChoice = z.infer<typeof toolChoiceSchema>;

/** What an undo restores: the goal's time settings, the graph and the settings. */
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

/** Reads a stored graph; anything unreadable counts as a graph not written yet. */
export function parsePlanGraph(value: unknown): PlanGraph {
  return parseOr({ fallback: { phases: [], skills: [] }, schema: planGraphSchema, value });
}

/** Reads stored settings; missing fields take their defaults. */
export function parsePlanSettings(value: unknown): PlanSettings {
  return parseOr({ fallback: planSettingsSchema.parse({}), schema: planSettingsSchema, value });
}

/** Reads stored phases; missing fields take their defaults. */
export function parsePlanPhases(value: unknown): PlanPhase[] {
  return parseOr({ fallback: [], schema: z.array(planPhaseSchema), value });
}

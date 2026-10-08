import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { z } from "zod";
import { type TargetCutoff } from "../../exams/cutoffs/target-cutoff-contract";
import { type GoalDraft, type GoalView, goalDraftSchema } from "../../goals/goal-contract";
import {
  DAYS_PER_WEEK,
  MAX_DAILY_MINUTES,
  MIN_DAILY_MINUTES,
} from "../../plans/planner/plan-state";
import { learningProfileUpdateSchema } from "../../profile/learning-profile-contract";

const MAX_GOAL_TEXT_LENGTH = 2000;
const MAX_ANSWER_LENGTH = 200;
/** A notice lists a few dozen subjects at most. */
const MAX_KNOWN_SUBJECTS = 40;
const MIN_LANGUAGE_LENGTH = 2;
const MAX_LANGUAGE_LENGTH = 10;
const STUDY_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

const timeZoneSchema = z
  .string()
  .refine(isValidTimeZone, { message: "Invalid timezone" })
  .optional()
  .meta({ description: "The learner's IANA timezone, for relative dates; UTC when left out" });

export const goalUnderstandingInputSchema = z
  .object({
    goal: z
      .string()
      .trim()
      .min(1)
      .max(MAX_GOAL_TEXT_LENGTH)
      .meta({ description: "What the learner wants to achieve, in their own words" }),
    language: z
      .string()
      .min(MIN_LANGUAGE_LENGTH)
      .max(MAX_LANGUAGE_LENGTH)
      .meta({ description: "The learner's language, for titles and notes" }),
    timeZone: timeZoneSchema,
  })
  .strict()
  .meta({ id: "GoalUnderstandingInput" });

export type GoalUnderstandingInput = z.infer<typeof goalUnderstandingInputSchema>;

/** Where onboarding starts placement: the learner's own level (nothing yet to advanced). */
const ownLevelSchema = z.enum(["none", "basic", "intermediate", "advanced"]);

export type OnboardingOwnLevel = z.infer<typeof ownLevelSchema>;

export const ONBOARDING_PURPOSES = [
  "overview",
  "deep",
  "work",
  "careerChange",
  "refresh",
  "other",
] as const;

export type OnboardingPurpose = (typeof ONBOARDING_PURPOSES)[number];

/**
 * An exam date read from the stored notice, with where it came from, or estimated from the
 * exam's usual timing when no notice for that year is stored yet.
 */
export type OnboardingExamDate = {
  date: string;
  /** No notice for that year yet: the day the exam usually falls on, labeled as an estimate. */
  estimated: boolean;
  label: string;
  /** The page it was read from, so the learner can check it; null for an estimate. */
  source: { title: string | null; url: string } | null;
};

/**
 * One goal as onboarding understood it: a draft ready for `POST /v1/goals` once the learner
 * confirms or edits it on the "Here's what I understood" card, with the exam's next dates from
 * its stored notice beside it. Targets are the learner's own: onboarding never promises them.
 * `details` holds what the words said (exam, target score, course or position, level, reason,
 * purpose, role), the questions they already answered and the onboarding the goals share.
 */
export type UnderstoodGoalView = {
  /**
   * The last published cut-off of the target the words named (a course at an institution, a
   * position), when another learner's research already found it; null otherwise.
   */
  cutoff: TargetCutoff | null;
  draft: GoalDraft;
  /** The exam's next dates from its stored notice; empty until research has read one. */
  examDates: OnboardingExamDate[];
};

/** The day's time for every goal, as the words said it or a gentle default. */
export type UnderstoodSchedule = {
  dailyMinutes: number;
  studyDays: number[] | null;
  studyTime: string | null;
  /** When the learner studies, in their words ("At night, after school"). */
  studyTimeNote: string | null;
};

/**
 * What a typed goal turned out to be: goals to plan (with every fact the text already gave), a
 * quick question for an explanation, an instrument (the waitlist, with musicianship offered as a
 * learn goal), something unsafe the app declines, or too vague to plan.
 */
export type GoalUnderstandingView =
  | { goals: UnderstoodGoalView[]; schedule: UnderstoodSchedule; status: "goals" }
  | { question: string; status: "explain" }
  | { instrument: string; status: "instrument" }
  | { status: "unclear" | "unsafe" };

/** Where a typed goal stands: being read, read (the card), or it couldn't be read. */
export const ONBOARDING_DRAFT_STATUSES = ["understanding", "understood", "failed"] as const;

type OnboardingDraftStatus = (typeof ONBOARDING_DRAFT_STATUSES)[number];

/**
 * A goal the learner typed, kept while they look at what was understood, so a refresh shows the
 * same screen (`/start?draft=`). `understanding` is null until the run reads the words (follow it
 * live at `GET /v1/generations/{generationId}/events`) and holds the learner's edits once it's
 * there. `goalId` is the main goal created from it once they confirmed.
 */
export type OnboardingDraftView = {
  /** The run reading the words; null when none is needed (a cached understanding) or none started. */
  generationId: string | null;
  goalId: string | null;
  id: string;
  prompt: string;
  status: OnboardingDraftStatus;
  understanding: GoalUnderstandingView | null;
};

/** Details the learner can fix in place, each on its own row of the card. */
const ONBOARDING_DRAFT_TEXT_FIELDS = [
  "institution",
  "reason",
  "role",
  "targetCourse",
  "targetPosition",
  "targetScore",
] as const;

/** Exam years the card accepts; the understanding keeps the same range. */
const MIN_EXAM_YEAR = 1900;
const MAX_EXAM_YEAR = 2200;

/** A sanity bound: understandings name a few goals at most. */
const MAX_DRAFT_GOAL_INDEX = 9;

const draftGoalSchema = z
  .int()
  .min(0)
  .max(MAX_DRAFT_GOAL_INDEX)
  .meta({ description: "Which goal of the card, in order: 0 is the main goal" });

const draftTextSchema = z.string().trim().min(1).max(MAX_ANSWER_LENGTH);

/**
 * One fix on the "Here's what I understood" card. Fields that depend on it follow: a new exam year
 * reads that year's exam dates (official or estimated) and drops a deadline set for the old year;
 * the learner's own deadline replaces the exam's dates on the card, and null brings them back; a
 * study time replaces the time the words gave. Fixing the words themselves is a new understanding.
 */
export const onboardingDraftEditSchema = z
  .discriminatedUnion("field", [
    z
      .object({
        field: z.literal("title"),
        goal: draftGoalSchema,
        value: goalDraftSchema.shape.title,
      })
      .strict(),
    z
      .object({
        field: z.literal("targetDate"),
        goal: draftGoalSchema,
        value: z.iso
          .date()
          .nullable()
          .meta({ description: "The learner's own deadline; null brings back the exam's dates" }),
      })
      .strict(),
    z
      .object({
        field: z.literal("examYear"),
        goal: draftGoalSchema,
        value: z.int().min(MIN_EXAM_YEAR).max(MAX_EXAM_YEAR),
      })
      .strict(),
    z
      .object({
        field: z.enum(ONBOARDING_DRAFT_TEXT_FIELDS),
        goal: draftGoalSchema,
        value: draftTextSchema.nullable().meta({ description: "Null removes it" }),
      })
      .strict(),
    z
      .object({
        field: z.literal("studyTime"),
        value: z
          .string()
          .regex(STUDY_TIME_PATTERN)
          .meta({ description: "HH:mm, shared by every goal of the card" }),
      })
      .strict(),
  ])
  .meta({ id: "OnboardingDraftEdit" });

export type OnboardingDraftEdit = z.infer<typeof onboardingDraftEditSchema>;

/**
 * What a returning visitor, guest or learner should continue: a goal they typed but didn't
 * confirm yet (`/start?draft=`), a goal still in onboarding (`/start/{goalId}`), or their day.
 */
export type OnboardingResumeView =
  | { draftId: string; kind: "draft"; prompt: string }
  | { goalId: string; kind: "goal"; title: string }
  | { kind: "today" };

/** The onboarding questions, in the order they're asked. Each one is a screen. */
export const ONBOARDING_QUESTIONS = [
  "purpose",
  "role",
  "reason",
  "target",
  "targetDate",
  "followUps",
  "level",
  "schedule",
] as const;

export type OnboardingQuestion = (typeof ONBOARDING_QUESTIONS)[number];

/**
 * Everything after the questions: about the learner, not the goal. `memory` asks a learner under
 * 18, or one whose age we don't know, whether memory may personalize their lessons, since it
 * starts off for them.
 */
type OnboardingProfileStep = "age" | "buddy" | "memory";

export type OnboardingStep = OnboardingProfileStep | OnboardingQuestion | "placement" | "plan";

/** A Library course that already teaches the goal, offered once the questions are answered. */
export type OnboardingLibraryCourse = {
  brandSlug: string;
  chapterCount: number;
  courseSlug: string;
  title: string;
};

/** The rest of onboarding for one new goal. */
export type OnboardingView = {
  /**
   * An exam's subjects from its stored notice, for the level question and before placement: the
   * notice's name (what `knownSubjects` sends back) and what learners call it when that's long.
   * Empty for other goals.
   */
  examSubjects: { name: string; shortName: string | null }[];
  /** Questions the AI asked for this goal, answered on the `followUps` screen. */
  followUps: string[];
  /**
   * The run writing the goal's curriculum, to follow live at `GET /v1/generations/{id}/events`;
   * null until it starts, a few seconds after the goal is created.
   */
  generationId: string | null;
  goal: GoalView;
  /** Goals created in the same onboarding, which share the day's time. */
  goalIds: string[];
  /** The learner is under 18: protective defaults, and the guardian invite is offered. */
  isMinor: boolean;
  /**
   * A published Library course that teaches the goal's subject, searched again once every
   * question is answered; null before that and when none fits.
   */
  libraryCourse: OnboardingLibraryCourse | null;
  /**
   * The daily minutes the time question starts on, from how big the goal is (a public exam asks
   * for more than a subject) and how soon its (or its exam's) date is. Only a starting pick: the
   * plan says what the time covers once it's built.
   */
  recommendedMinutes: number;
  /** Onboarding screens still ahead, in order, ending with the plan. */
  steps: OnboardingStep[];
};

const nullableAnswer = z.string().trim().min(1).max(MAX_ANSWER_LENGTH).nullable();

const scheduleAnswerSchema = z
  .object({
    dailyMinutes: z.int().min(MIN_DAILY_MINUTES).max(MAX_DAILY_MINUTES),
    question: z.literal("schedule"),
    studyDays: z
      .array(
        z
          .int()
          .min(0)
          .max(DAYS_PER_WEEK - 1),
      )
      .min(1)
      .max(DAYS_PER_WEEK)
      .optional(),
    timeZone: timeZoneSchema,
    weekendMinutes: z
      .int()
      .min(MIN_DAILY_MINUTES)
      .max(MAX_DAILY_MINUTES)
      .optional()
      .meta({
        description:
          "Minutes on Saturday and Sunday when they differ from the other days; only study days take them",
      }),
  })
  .strict();

/**
 * One onboarding answer. Skippable questions take null. "Placement" marks placement done, after
 * the learner finished it, stopped it or chose to start from scratch. Age, memory and buddy are
 * saved on the learner's profile; a birth date under 13 deletes the account, since Zoonk is for 13
 * and older.
 */
export const onboardingAnswerInputSchema = z
  .discriminatedUnion("question", [
    z.object({ purpose: z.enum(ONBOARDING_PURPOSES), question: z.literal("purpose") }).strict(),
    z
      .object({
        question: z.literal("role"),
        role: nullableAnswer.meta({ description: "The learner's current role" }),
        targetPosition: nullableAnswer
          .optional()
          .meta({ description: "For a career change, the role they're aiming for" }),
        tasks: nullableAnswer
          .optional()
          .meta({ description: "For work, what they use the subject for in their job" }),
      })
      .strict(),
    z.object({ question: z.literal("reason"), reason: nullableAnswer }).strict(),
    z.object({ question: z.literal("target"), target: nullableAnswer }).strict(),
    z.object({ question: z.literal("targetDate"), targetDate: z.iso.date().nullable() }).strict(),
    z
      .object({ answers: z.array(nullableAnswer).max(2), question: z.literal("followUps") })
      .strict(),
    z
      .object({
        knownSubjects: z
          .array(z.string().trim().min(1).max(MAX_ANSWER_LENGTH))
          .max(MAX_KNOWN_SUBJECTS)
          .optional()
          .meta({
            description:
              "For an exam with several subjects: the notice's subjects the learner already knows well, whose basics the plan skips",
          }),
        level: ownLevelSchema.nullable(),
        question: z.literal("level"),
      })
      .strict(),
    scheduleAnswerSchema,
    z.object({ question: z.literal("placement") }).strict(),
    z
      .object({
        birth: learningProfileUpdateSchema.shape.birth
          .unwrap()
          .nullable()
          .meta({ description: "Null when the learner prefers not to say" }),
        question: z.literal("age"),
      })
      .strict(),
    z
      .object({
        enabled: z
          .boolean()
          .meta({
            description:
              'Whether memory may personalize the learner\'s lessons: true for yes, false for "Not now"',
          }),
        question: z.literal("memory"),
      })
      .strict(),
    z
      .object({
        buddy: learningProfileUpdateSchema.shape.buddy.unwrap(),
        question: z.literal("buddy"),
      })
      .strict(),
  ])
  .meta({ id: "OnboardingAnswerInput" });

export type OnboardingAnswerInput = z.infer<typeof onboardingAnswerInputSchema>;

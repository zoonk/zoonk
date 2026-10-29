import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { z } from "zod";
import {
  type ExamChoiceView,
  examChoicePickSchema,
} from "../../exams/choices/exam-choice-contract";
import { type TargetCutoff } from "../../exams/cutoffs/target-cutoff-contract";
import { type GoalDraft, type GoalView, goalDraftSchema } from "../../goals/goal-contract";
import { MAX_GOAL_PROMPT_LENGTH } from "../../goals/goal-input-limits";
import { MAX_DAILY_MINUTES, MIN_DAILY_MINUTES } from "../../plans/daily-minutes";
import { DAYS_PER_WEEK } from "../../plans/planner/plan-state";
import { learningProfileUpdateSchema } from "../../profile/learning-profile-contract";
import { MAX_ONBOARDING_ANSWER_LENGTH } from "./onboarding-limits";

const MAX_KNOWN_SUBJECTS = 40;
const MAX_EXAM_CHOICES = 5;
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
      .max(MAX_GOAL_PROMPT_LENGTH)
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

export type OnboardingExamDate = {
  date: string;
  /** No notice for that year yet: the day the exam usually falls on, labeled as an estimate. */
  estimated: boolean;
  label: string;
  registrationClosed: boolean;
  /** The page it was read from, so the learner can check it; null for an estimate. */
  source: { title: string | null; url: string } | null;
};

/** Confirmed drafts can create goals; targets remain learner choices rather than promises. */
export type UnderstoodGoalView = {
  /** Stored public cutoff only; null when prior research has not found it. */
  cutoff: TargetCutoff | null;
  draft: GoalDraft;
  /** Empty until research has stored notice dates. */
  examDates: OnboardingExamDate[];
};

export type UnderstoodSchedule = {
  dailyMinutes: number;
  studyDays: number[] | null;
  studyTime: string | null;
  /** When the learner studies, in their words ("At night, after school"). */
  studyTimeNote: string | null;
};

export type GoalUnderstandingView =
  | { goals: UnderstoodGoalView[]; schedule: UnderstoodSchedule; status: "goals" }
  | { question: string; status: "explain" }
  | { instrument: string; status: "instrument" }
  | { status: "unclear" | "unsafe" };

export const ONBOARDING_DRAFT_STATUSES = ["understanding", "understood", "failed"] as const;

type OnboardingDraftStatus = (typeof ONBOARDING_DRAFT_STATUSES)[number];

/** understanding retains learner edits; goalId identifies the main confirmed goal and generationId follows live progress. */
export type OnboardingDraftView = {
  /** The run reading the words; null when none is needed (a cached understanding) or none started. */
  generationId: string | null;
  goalId: string | null;
  id: string;
  prompt: string;
  status: OnboardingDraftStatus;
  understanding: GoalUnderstandingView | null;
};

const ONBOARDING_DRAFT_TEXT_FIELDS = [
  "institution",
  "reason",
  "role",
  "targetCourse",
  "targetPosition",
  "targetScore",
] as const;

const MAX_DRAFT_GOAL_INDEX = 9;

const draftGoalSchema = z
  .int()
  .min(0)
  .max(MAX_DRAFT_GOAL_INDEX)
  .meta({ description: "Which goal of the card, in order: 0 is the main goal" });

const draftTextSchema = z.string().trim().min(1).max(MAX_ONBOARDING_ANSWER_LENGTH);

/** Dependent fields follow edits; null dates restore exam dates, while changing the original words needs a new understanding. */
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
          .meta({
            description:
              "The learner's own deadline; null brings back the exam's dates. From the learner's today (an earlier one is refused with 422) to at most 3,650 days after it (a later one with 422 TARGET_DATE_OUT_OF_RANGE)",
          }),
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
  "examChoice",
  "level",
  "schedule",
] as const;

export type OnboardingQuestion = (typeof ONBOARDING_QUESTIONS)[number];

/** Buddy choice follows goal questions because it belongs to the learner profile. */
export type OnboardingStep = OnboardingQuestion | "buddy" | "placement" | "plan";

export type OnboardingLibraryCourse = {
  brandSlug: string;
  chapterCount: number;
  courseSlug: string;
  title: string;
};

export type OnboardingView = {
  /** Studies only selected options; empty when the exam offers no choices. */
  examChoices: ExamChoiceView[];
  /** First day defaults the plan date unless overridden; null outside public course exam starts. */
  examDays: { days: string[]; estimated: boolean } | null;
  /** knownSubjects must send notice names, not display short names. */
  examSubjects: { name: string; shortName: string | null }[];
  followUps: string[];
  /** Follow via GET /v1/generations/{id}/events; null until the run starts. */
  generationId: string | null;
  goal: GoalView;
  /** Goals created in the same onboarding, which share the day's time. */
  goalIds: string[];
  /** Searched again after all questions; null before then or when no public course fits. */
  libraryCourse: OnboardingLibraryCourse | null;
  /** Initial choice only; preserve course-page selections and never imply the recommendation guarantees plan coverage. */
  recommendedMinutes: number;
  /** Onboarding screens still ahead, in order, ending with the plan. */
  steps: OnboardingStep[];
};

const nullableAnswer = z.string().trim().min(1).max(MAX_ONBOARDING_ANSWER_LENGTH).nullable();

/** Generated iOS clients omit nil fields, so omission must equal an explicit null skipped answer. */
const skippableAnswer = nullableAnswer.default(null);

const scheduleAnswerSchema = z
  .object({
    dailyMinutes: z.int().min(MIN_DAILY_MINUTES).max(MAX_DAILY_MINUTES),
    fullCourse: z
      .boolean()
      .optional()
      .meta({
        description:
          "Exams only: study everything, even after the exam (see the plan change `setFullCourse`). Until the exam the plan stays the one its date shapes; what doesn't fit goes on after it",
      }),
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

/** Null skips skippable questions; placement marks completion after finishing, stopping, or opting out. */
export const onboardingAnswerInputSchema = z
  .discriminatedUnion("question", [
    z.object({ purpose: z.enum(ONBOARDING_PURPOSES), question: z.literal("purpose") }).strict(),
    z
      .object({
        question: z.literal("role"),
        role: skippableAnswer.meta({ description: "The learner's current role" }),
        targetPosition: nullableAnswer
          .optional()
          .meta({ description: "For a career change, the role they're aiming for" }),
        tasks: nullableAnswer
          .optional()
          .meta({ description: "For work, what they use the subject for in their job" }),
      })
      .strict(),
    z.object({ question: z.literal("reason"), reason: skippableAnswer }).strict(),
    z.object({ question: z.literal("target"), target: skippableAnswer }).strict(),
    z
      .object({
        question: z.literal("targetDate"),
        targetDate: z.iso
          .date()
          .nullable()
          .default(null)
          .meta({
            description:
              "The learner's deadline, or null for none: after their today (an earlier one is refused with 422) and at most 3,650 days after it (a later one with 422 TARGET_DATE_OUT_OF_RANGE)",
          }),
      })
      .strict(),
    z
      .object({ answers: z.array(nullableAnswer).max(2), question: z.literal("followUps") })
      .strict(),
    z
      .object({
        choices: z
          .array(examChoicePickSchema)
          .min(1)
          .max(MAX_EXAM_CHOICES)
          .nullable()
          .default(null)
          .meta({
            description:
              "The option the learner takes for each of the exam's choices (`examChoices`); null to decide later, from the plan",
          }),
        question: z.literal("examChoice"),
        timeZone: timeZoneSchema,
      })
      .strict(),
    z
      .object({
        knownSubjects: z
          .array(z.string().trim().min(1).max(MAX_ONBOARDING_ANSWER_LENGTH))
          .max(MAX_KNOWN_SUBJECTS)
          .optional()
          .meta({
            description:
              "For an exam with several subjects: the notice's subjects the learner already knows well, whose basics the plan skips",
          }),
        level: ownLevelSchema.nullable().default(null),
        question: z.literal("level"),
      })
      .strict(),
    scheduleAnswerSchema,
    z.object({ question: z.literal("placement") }).strict(),
    z
      .object({
        buddy: learningProfileUpdateSchema.shape.buddy.unwrap(),
        question: z.literal("buddy"),
      })
      .strict(),
  ])
  .meta({ id: "OnboardingAnswerInput" });

export type OnboardingAnswerInput = z.infer<typeof onboardingAnswerInputSchema>;

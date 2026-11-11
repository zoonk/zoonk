import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { targetCutoffSchema } from "../../exams/cutoffs/target-cutoff-contract";
import { goalContentCountrySchema } from "../../goals/country-contract";
import { goalDraftSchema, regionChoiceSchema } from "../../goals/goal-contract";
import { languageAimViewSchema } from "../../language/aims/language-aim-schemas";
import {
  type GoalUnderstandingView,
  ONBOARDING_DRAFT_STATUSES,
  type OnboardingDraftView,
  type OnboardingExamDate,
  type OnboardingResumeView,
  type UnderstoodGoalView,
} from "./onboarding-contract";

const examDateSchema = z
  .object({
    date: z.iso.date(),
    estimated: z
      .boolean()
      .meta({
        description:
          "No notice for that year is stored yet: the day the exam usually falls on, to show as an estimate",
      }),
    label: z.string(),
    registrationClosed: z
      .boolean()
      .meta({
        description:
          "The notice gives this sitting's last day to register, and it has passed: left out of the sittings a learner without a date picks from",
      }),
    source: z
      .object({ title: z.string().nullable(), url: z.string() })
      .nullable()
      .meta({ description: "The official page the date was read from; null for an estimate" }),
  })
  .meta({ id: "OnboardingExamDate" }) satisfies z.ZodType<OnboardingExamDate>;

const understoodGoalSchema = z
  .object({
    contentCountry: goalContentCountrySchema.nullable().optional(),
    countryDependent: z.boolean().optional(),
    cutoff: targetCutoffSchema
      .nullable()
      .default(null)
      .meta({
        description:
          "The last published cut-off of the target the words named (a course at an institution, a position) with its source, when it's already known: where the bar was, never a promise. Null otherwise",
      }),
    draft: goalDraftSchema.meta({
      description:
        "Ready for POST /goals once the learner confirms or edits it. `details` holds what the words said, the questions they already answered and the onboarding the goals share (`onboardingId`, the draft's id).",
    }),
    examDates: z
      .array(examDateSchema)
      .meta({
        description:
          "The exam's dates for the named year (or the next ones): from its stored notice, or estimated from its usual timing",
      }),
    languageAim: languageAimViewSchema
      .nullable()
      .default(null)
      .meta({
        description:
          "Language goals only: the level the words aim for and the aims the card offers instead. Edit it with field targetScore set to one of the choices' aims; null for other goals",
      }),
    regionChoices: z
      .array(regionChoiceSchema)
      .default([])
      .meta({
        description:
          "The countries a language goal can pick for `draft.targetRegion`, named in the learner's language; edit it with field targetRegion. Empty for other goals and languages without countries",
      }),
  })
  .meta({ id: "UnderstoodGoal" }) satisfies z.ZodType<UnderstoodGoalView>;

export const goalUnderstandingViewSchema = z
  .discriminatedUnion("status", [
    z.object({
      goals: z.array(understoodGoalSchema).min(1).meta({ description: "The main goal first" }),
      schedule: z.object({
        dailyMinutes: z
          .int()
          .meta({ description: "Minutes a day for all the goals: what the learner said, or 15" }),
        studyDays: z.array(z.int()).nullable(),
        studyTime: z.string().nullable(),
        studyTimeNote: z
          .string()
          .nullable()
          .meta({ description: "When the learner studies, in their words" }),
      }),
      status: z.literal("goals"),
    }),
    z.object({
      question: z.string().meta({ description: "The question as a short title" }),
      status: z.literal("explain"),
    }),
    z.object({
      instrument: z
        .string()
        .meta({
          description: "Playing it joins the waitlist; musicianship is offered as a learn goal",
        }),
      status: z.literal("instrument"),
    }),
    z.object({
      status: z
        .enum(["unclear", "unsafe"])
        .meta({ description: "Too vague to plan (ask for more), or a goal the app declines" }),
    }),
  ])
  .meta({ id: "GoalUnderstanding" }) satisfies z.ZodType<GoalUnderstandingView>;

export const onboardingDraftViewSchema = z
  .object({
    activeGoalsLeft: z
      .int()
      .nullable()
      .meta({
        description:
          "How many more goals the learner's plan follows now: its cap less the active goals they follow, read with this response; null on Plus. Show and send only this many of the card's first goals; the rest are Plus's, shown locked with the subscribe call to action, and stay on the draft to start from the learner's goals once one of the card's goals has started and another fits. At 0, show the plan's limit instead of confirming. When `goalId` is set, open that goal's setup instead.",
      }),
    generationId: z
      .string()
      .nullable()
      .meta({
        description:
          "The run reading the words, followed live at `GET /v1/generations/{generationId}/events` (`readGoal`, `findExamDates` when the words name an exam, then `understandingReady`); null when none is needed or none started yet",
      }),
    goalId: uuidSchema()
      .nullable()
      .meta({ description: "The main goal created from the draft once the learner confirmed it" }),
    id: uuidSchema(),
    prompt: z.string().meta({ description: "What the learner typed" }),
    status: z
      .enum(ONBOARDING_DRAFT_STATUSES)
      .meta({
        description:
          "`understanding` while the words are read, `understood` once `understanding` is there, `failed` when they couldn't be read (start it again)",
      }),
    timeZone: z
      .string()
      .meta({
        description:
          "The IANA zone the draft counts the learner's today in. A `targetDate` fix is accepted from the day after that today through 3,650 days after it, so a date picker offers exactly those days",
      }),
    understanding: goalUnderstandingViewSchema
      .nullable()
      .meta({ description: "What was understood, with the learner's fixes; null until then" }),
  })
  .meta({ id: "OnboardingDraft" }) satisfies z.ZodType<OnboardingDraftView>;

export const onboardingResumeSchema = z
  .object({
    resume: z
      .discriminatedUnion("kind", [
        z.object({
          draftId: uuidSchema().meta({ description: "Read it at GET /goal-understandings/{id}" }),
          kind: z.literal("draft"),
          prompt: z.string().meta({ description: "What the learner typed" }),
        }),
        z.object({
          goalId: uuidSchema().meta({ description: "Continue at GET /goals/{goalId}/onboarding" }),
          kind: z.literal("goal"),
          title: z.string(),
        }),
        z.object({ kind: z.literal("today") }),
      ])
      .nullable()
      .meta({
        description:
          "A goal typed but not confirmed yet, the newest goal while its onboarding hasn't reached the plan, or the day; null when there's nothing to continue",
      }),
  })
  .meta({ id: "OnboardingResume" }) satisfies z.ZodType<{ resume: OnboardingResumeView | null }>;

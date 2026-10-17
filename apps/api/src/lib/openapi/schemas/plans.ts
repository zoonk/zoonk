import { examChoiceViewSchema } from "@zoonk/core/exams/choices/contract";
import { examDocumentSchema } from "@zoonk/core/exams/document";
import { LANGUAGE_ACTIVITY_TYPES } from "@zoonk/core/language/activities";
import { ownLevelSchema } from "@zoonk/core/learner/placement/contract";
import { planChangeSchema } from "@zoonk/core/plans/change-contract";
import { planCourseSchema } from "@zoonk/core/plans/course-contract";
import { mockFundingSchema } from "@zoonk/core/plans/mock-funding-contract";
import { planNumbersSchema } from "@zoonk/core/plans/numbers-contract";
import { type OwnLevelChange } from "@zoonk/core/plans/own-level-contract";
import { TOOL_CHOICES, TOOL_SYSTEMS } from "@zoonk/core/plans/tools-contract";
import { type PlanView } from "@zoonk/core/plans/view-contract";
import { writtenPracticeSchema } from "@zoonk/core/plans/written-practice-contract";
import { GoalKind } from "@zoonk/db";
import { z } from "zod";
import { noSittingSchema, noticeDaySchema } from "./notice-dates";
import { planAreaSchema } from "./plan-areas";
import { planBasesSchema } from "./plan-bases";
import { planFeasibilitySchema } from "./plan-feasibility";
import { planItemSchema } from "./plan-items";
import { planMockScheduleSchema } from "./plan-mock-schedule";
import { planFitOfferSchema } from "./plan-offers";
import { phaseKindSchema, planPhaseSchema } from "./plan-phases";
import { planStatusSchema } from "./preparation";
import { shortPlanSchema } from "./short-exam-plans";

const isoDateSchema = z.iso.date();

const planToolSchema = z
  .object({
    choice: z
      .enum(TOOL_CHOICES)
      .nullable()
      .meta({
        description:
          "null until the learner answers: have (they have it), setup (a setup lesson comes first), none (no install, examples only)",
      }),
    essential: z
      .boolean()
      .meta({ description: "True when a chapter needs it to practice; false when it only helps" }),
    later: z
      .boolean()
      .meta({
        description:
          "Only later phases use it; clients list it under More later instead of asking now",
      }),
    name: z
      .string()
      .meta({ description: "Generic name, such as Spreadsheet (Google Sheets or Excel)" }),
    system: z
      .enum(TOOL_SYSTEMS)
      .nullable()
      .meta({ description: "The device the setup lesson is for; phone means no computer" }),
  })
  .meta({ id: "PlanTool" });

const planDaySchema = z
  .object({
    date: isoDateSchema,
    items: z.array(planItemSchema),
    minutes: z.number().nonnegative(),
    mockFunding: mockFundingSchema.nullable(),
    state: z.enum(["done", "missed", "rest", "today", "upcoming"]),
  })
  .meta({ id: "PlanDay" });

export const planResponseSchema = z
  .object({
    access: z.object({
      freeUntil: isoDateSchema.nullable().meta({ description: "Last day a free exam plan covers" }),
      freeWeekOver: z
        .boolean()
        .meta({
          description:
            "A free exam plan past its first week: its new lessons, practice, challenges and mocks come with Plus, while reviews and fixing mistakes stay free",
        }),
      mocksRequirePlus: z.boolean(),
    }),
    areas: z.array(planAreaSchema),
    bases: planBasesSchema
      .nullable()
      .meta({ description: "The plan's bases to choose how to study; null when it has none" }),
    changes: z
      .array(planChangeSchema)
      .meta({ description: "Proposals first, then the last two weeks" }),
    course: planCourseSchema
      .nullable()
      .meta({
        description: "The Library course the plan is built from, with its levels; null without one",
      }),
    currentPhase: z.int().nullable(),
    end: z
      .object({
        kind: z
          .literal("finished")
          .meta({
            description:
              "Every lesson was studied or tested out and every required phase challenge won; Free language plans can finish with their Plus call challenges still locked",
          }),
      })
      .nullable()
      .meta({
        description:
          "Every lesson of the plan is studied or tested out and every required phase challenge won: time for what to study next (`GET /v1/goals/{goalId}/map`'s `next`, and POST `/v1/goals/{goalId}/next-level`). Free language plans can finish with their Plus call challenges still locked; those challenges retain their pending state, with no won result. Non-exam reviews remain practice after finishing; exams also wait for their mocks and reviews still ahead. Null while something required is left, lessons set aside included (a plan whose date came with lessons left isn't over: status `pastDate`) and required challenges too (status `challengesLeft`)",
      }),
    estimate: z.object({
      endDate: isoDateSchema.nullable(),
      pace: z
        .object({ factor: z.number(), source: z.enum(["own", "course", "typical"]) })
        .nullable(),
      remainingHours: z.number().min(0),
      totalHours: z.number().min(0),
    }),
    examChoices: z
      .array(examChoiceViewSchema)
      .meta({
        description:
          "The exam's choices (ENEM's foreign language: English or Spanish), each with its options and the one the learner takes (null until picked), which POST /v1/goals/{goalId}/plan/exam-choices changes; the plan studies only the picked options. Empty without choices",
      }),
    examDocument: examDocumentSchema,
    feasibility: planFeasibilitySchema.nullable(),
    fitOffer: planFitOfferSchema,
    fundedMocks: z
      .array(planItemSchema.extend({ id: z.uuid() }))
      .describe(
        "Actual future todo mock items whose saved funding has started, with their real duration. Move them using the existing plan operation and item ID.",
      ),
    goalId: z.uuid(),
    notice: z
      .enum(["reading", "usual"])
      .nullable()
      .meta({
        description:
          "An exam plan built before research read the exam's notice: reading while the reveal waits for that reading; usual once the wait ended without it (the plan follows the exam's usual structure and the reading arrives as a change to apply); null otherwise",
      }),
    numbers: planNumbersSchema.nullable(),
    ownLevel: ownLevelSchema
      .nullable()
      .meta({ description: "The level the learner gave; null when they didn't say" }),
    phases: z.array(planPhaseSchema),
    planId: z.uuid(),
    ready: z.boolean().meta({ description: "False while the planner is building the plan" }),

    schedule: z.object({
      dailyMinutes: z.int(),
      fullCourse: z
        .boolean()
        .meta({
          description:
            "The exam plan studies everything: what doesn't fit before the exam goes on after it (`setFullCourse`); the exam keeps its date. False for other goals, which study everything without a date",
        }),
      lightWeeks: z.array(z.object({ endDate: isoDateSchema, startDate: isoDateSchema })),
      mocks: planMockScheduleSchema,
      nextSitting: isoDateSchema
        .nullable()
        .meta({
          description:
            "For a plan that goes on after its exam (`fullCourse`), whose mocks there are for the exam's next sitting: that sitting's first day, when the notice lists it; null otherwise",
        }),
      noSitting: noSittingSchema,
      noticeDay: noticeDaySchema,
      studyDays: z.int().min(0).max(7),
      targetDate: isoDateSchema.nullable(),
      targetDateEstimated: z
        .boolean()
        .meta({ description: "The date is the likely day of an exam whose notice isn't out yet" }),
      targetDateNamedMonth: z
        .boolean()
        .meta({
          description:
            "The date is the start of the month the learner named, standing for that month: say the month, not the day",
        }),
      weekdayMinutes: z.array(z.int()).meta({ description: "Sunday first; 0 for rest days" }),
    }),
    shortPlan: shortPlanSchema,
    status: planStatusSchema.nullable(),
    steering: z.object({
      difficultyBias: z.enum(["easier", "standard", "harder"]),
      lessonsStudied: z
        .int()
        .min(0)
        .meta({
          description:
            "Lessons of the plan the learner studied, not the ones placement skipped; ask how it's going only after the first",
        }),
      practiceBias: z.enum(["moreExplanation", "balanced", "morePractice"]),
      skippedActivities: z
        .array(z.enum(LANGUAGE_ACTIVITY_TYPES))
        .meta({ description: "Language practice left out of lessons; empty for other goals" }),
    }),
    tools: z
      .array(planToolSchema)
      .meta({
        description:
          "You'll use: the tools the plan's chapters use, essential first, with the learner's answer; empty when none do",
      }),
    week: z.object({
      days: z.array(planDaySchema),
      endDate: isoDateSchema,
      startDate: isoDateSchema,
    }),
    writtenPractice: writtenPracticeSchema
      .nullable()
      .meta({
        description:
          "When the exam's written tests (an essay, a discursive test) are practiced, which the learner chooses; the total practice stays the same. Null for plans without written tests and for a test days away",
      }),
  })
  .meta({ id: "Plan" }) satisfies z.ZodType<PlanView>;

export const ownLevelChangeSchema = z
  .object({
    change: planChangeSchema
      .nullable()
      .meta({
        description:
          "Lower levels: the foundations added before the skills they prepare for, with an undo; null when the plan already starts from them",
      }),
    direction: z.enum(["higher", "lower", "same"]),
    level: ownLevelSchema,
    testOuts: z
      .array(z.object({ chapterId: z.uuid(), title: z.string() }))
      .meta({
        description:
          "Higher levels: chapters the new level covers, to test out of (GET /goals/{goalId}/chapters/{chapterId}/test-out); nothing is skipped until a test-out is passed",
      }),
  })
  .meta({ id: "OwnLevelChange" }) satisfies z.ZodType<OwnLevelChange>;

export const planChangeResultSchema = z
  .object({
    change: planChangeSchema
      .nullable()
      .meta({ description: "Null when the plan isn't built yet, or when nothing changed" }),
    reason: z
      .enum(["alreadyIn", "cantMove"])
      .nullable()
      .optional()
      .meta({
        description:
          "Why a change of focus changed nothing (`unchanged`): `alreadyIn` (the subjects it focuses on already have every lesson in the plan) or `cantMove` (they already start as early as what they build on allows, and more of them doesn't fit)",
      }),
    status: z
      .enum(["applied", "proposed", "unchanged"])
      .meta({
        description:
          "Proposed changes wait for the learner's OK: they move more than a lesson. `unchanged`: a change of focus alone wouldn't do what it asks (focusing on subjects would leave the plan as it is, or more or less of some subjects would do the opposite in the plan the learner sees), so nothing was saved",
      }),
  })
  .meta({ id: "PlanChangeResult" });

export const planLinkResponseSchema = z
  .object({
    outline: z.object({
      goalKind: z.enum(GoalKind),
      hours: z.number().min(0),
      language: z.string(),
      phases: z.array(
        z.object({
          hours: z.number().min(0),
          kind: phaseKindSchema.meta({
            description: "Exam phases have no name; clients name them by kind",
          }),
          milestone: z.string().nullable(),
          name: z.string(),
        }),
      ),
      skillCount: z.int().min(0),
      subject: z
        .object({ description: z.string().nullable(), title: z.string() })
        .nullable()
        .meta({ description: "The public course or exam, for the page's title and preview" }),
      targetLanguage: z.string().nullable(),
    }),
    owner: z
      .object({ goalId: z.uuid() })
      .nullable()
      .meta({
        description: "Set only when the viewer made the plan, so the client shows their own plan",
      }),
  })
  .meta({ id: "PlanLink" });

import { LANGUAGE_ACTIVITY_TYPES } from "@zoonk/core/language/activities";
import { ownLevelSchema } from "@zoonk/core/learner/placement/contract";
import { anyPlanOperationSchema } from "@zoonk/core/plans/contract";
import { planCourseSchema } from "@zoonk/core/plans/course-contract";
import { type OwnLevelChange } from "@zoonk/core/plans/own-level-contract";
import { TOOL_CHOICES, TOOL_SYSTEMS } from "@zoonk/core/plans/tools-contract";
import { type PlanChangeView, type PlanView } from "@zoonk/core/plans/view-contract";
import { GoalKind, PlanChangeStatus, PlanItemKind, PlanItemStatus } from "@zoonk/db";
import { z } from "zod";
import { planPhaseSchema } from "./plan-phases";
import { planStatusSchema } from "./preparation";
import { shortPlanSchema } from "./short-exam-plans";

const isoDateSchema = z.iso.date();

export const planEffectSchema = z
  .object({
    endDateAfter: isoDateSchema
      .nullable()
      .meta({ description: "When the plan ends after the change" }),
    endDateBefore: isoDateSchema.nullable().meta({ description: "When it ended before" }),
    lessonsAdded: z.int().min(0),
    lessonsRemoved: z.int().min(0),
  })
  .meta({ id: "PlanEffect" });

export const planChangeSchema = z
  .object({
    canUndo: z
      .boolean()
      .meta({ description: "True while the plan is still as the change left it" }),
    createdAt: z.iso.datetime(),
    days: z.int().nullable().meta({ description: "Study days missed, for missedDays" }),
    effect: planEffectSchema.nullable(),
    id: z.uuid(),
    kind: z
      .string()
      .meta({
        description:
          "edited, testedOut, missedDays, estimateUpdated or resumed; keep unknown kinds",
      }),
    lessonsSkipped: z.int().min(0).meta({ description: "Lessons a test-out skipped" }),
    operations: z.array(anyPlanOperationSchema),
    reason: z
      .string()
      .nullable()
      .meta({
        description:
          "The sentence to show as written when an AI or a proposal wrote it; null when the client says it from kind, operations and effect",
      }),
    source: z
      .string()
      .meta({ description: "learner, planEdit, system, or the part that proposed it" }),
    status: z.enum(PlanChangeStatus),
  })
  .meta({ id: "PlanChange" }) satisfies z.ZodType<PlanChangeView>;

const planItemSchema = z
  .object({
    chapterId: z.uuid().nullable(),
    id: z.uuid(),
    kind: z.enum(PlanItemKind),
    lessonId: z.uuid().nullable(),
    minutes: z.int().nullable(),
    requiresPlus: z
      .boolean()
      .meta({ description: "Free exam plans cover the first week and no mock exams" }),
    scheduledFor: isoDateSchema.nullable(),
    skillId: z.uuid().nullable(),
    status: z.enum(PlanItemStatus),
    title: z
      .string()
      .meta({
        description:
          "The lesson's title; for a skill whose lessons are still being written, its course's (empty when unknown)",
      }),
    writing: z
      .boolean()
      .meta({
        description:
          "A stand-in for a skill whose lessons are still being written; show it as being written, never by the skill's name",
      }),
  })
  .meta({ id: "PlanItem" });

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
    minutes: z.int().min(0),
    state: z.enum(["done", "missed", "rest", "today", "upcoming"]),
  })
  .meta({ id: "PlanDay" });

export const planResponseSchema = z
  .object({
    access: z.object({
      freeUntil: isoDateSchema.nullable().meta({ description: "Last day a free exam plan covers" }),
      mocksRequirePlus: z.boolean(),
    }),
    areas: z.array(
      z.object({
        focused: z.boolean(),
        name: z.string(),
        skillCount: z.int(),
        skipped: z.boolean(),
      }),
    ),
    changes: z
      .array(planChangeSchema)
      .meta({ description: "Proposals first, then the last two weeks" }),
    course: planCourseSchema
      .nullable()
      .meta({
        description: "The Library course the plan is built from, with its levels; null without one",
      }),
    currentPhase: z.int().nullable(),
    estimate: z.object({
      endDate: isoDateSchema.nullable(),
      pace: z
        .object({ factor: z.number(), source: z.enum(["own", "course", "typical"]) })
        .nullable(),
      remainingHours: z.number().min(0),
      totalHours: z.number().min(0),
    }),
    feasibility: z
      .object({
        alternative: z
          .object({ dailyMinutes: z.int(), endDate: isoDateSchema.nullable() })
          .nullable()
          .meta({ description: "Without a deadline: when the plan ends with more time a day" }),
        coveredShare: z
          .number()
          .min(0)
          .max(1)
          .meta({ description: "Share of the goal's weight covered" }),
        deadline: isoDateSchema.nullable(),
        fits: z.boolean(),
        recommendedMinutes: z
          .int()
          .nullable()
          .meta({ description: "Daily minutes that would cover everything" }),
      })
      .nullable(),
    finished: z
      .boolean()
      .meta({ description: "Every lesson and chapter is done: time for what to study next" }),
    goalId: z.uuid(),
    ownLevel: ownLevelSchema
      .nullable()
      .meta({ description: "The level the learner gave; null when they didn't say" }),
    phases: z.array(planPhaseSchema),
    planId: z.uuid(),
    ready: z.boolean().meta({ description: "False while the planner is building the plan" }),

    schedule: z.object({
      dailyMinutes: z.int(),
      lightWeeks: z.array(z.object({ endDate: isoDateSchema, startDate: isoDateSchema })),
      studyDays: z.int().min(0).max(7),
      targetDate: isoDateSchema.nullable(),
      weekdayMinutes: z.array(z.int()).meta({ description: "Sunday first; 0 for rest days" }),
    }),
    shortPlan: shortPlanSchema,
    status: planStatusSchema.nullable(),
    steering: z.object({
      difficultyBias: z.enum(["easier", "standard", "harder"]),
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
    change: planChangeSchema.nullable().meta({ description: "Null when the plan isn't built yet" }),
    status: z
      .enum(["applied", "proposed"])
      .meta({
        description: "Proposed changes wait for the learner's OK: they move more than a lesson",
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
        z.object({ hours: z.number().min(0), milestone: z.string().nullable(), name: z.string() }),
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

import { type GoalView, regionChoiceSchema } from "@zoonk/core/goals/contract";
import { goalCountryFieldsSchema } from "@zoonk/core/goals/country-contract";
import { planChangeSchema } from "@zoonk/core/plans/change-contract";
import { GoalKind } from "@zoonk/db";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { weekdayNumberSchema } from "./weekday-number";

const isoDateSchema = z.iso.date();

export const goalSchema = z
  .object({
    ...goalCountryFieldsSchema.shape,
    createdAt: z.iso.datetime(),
    dailyMinutes: z.int(),
    details: z.record(z.string(), z.unknown()).meta({ description: "What onboarding understood" }),
    displayName: z.string(),
    examBlueprintId: uuidSchema().nullable(),
    id: uuidSchema(),
    isActive: z
      .boolean()
      .meta({ description: "The goal the tabs show: the main goal, whose session comes first" }),
    kind: z.enum(GoalKind),
    language: z.string(),
    languageFlag: z
      .string()
      .nullable()
      .meta({
        description:
          "A language goal's flag, as flag-icons names it: its `targetRegion`'s when set, else its language's, as a language course's (a country's two-letter code, or a region's: `es-ct`, `gb-wls`, `arab`); null for other goals",
      }),
    plan: z
      .object({
        currentPhase: z.int().nullable(),
        endDate: isoDateSchema.nullable(),
        lessonsDone: z
          .int()
          .min(0)
          .meta({ description: "Lessons the learner studied; lessons set aside never count" }),
        lessonsTotal: z
          .int()
          .min(0)
          .meta({
            description:
              "Lessons in the plan: every one but those tested out, which are off the plan",
          }),
        phaseCount: z.int().min(0),
        ready: z.boolean().meta({ description: "False while the planner is building the plan" }),
      })
      .nullable(),
    primaryCourseId: uuidSchema().nullable(),
    prompt: z.string().meta({ description: "What the learner typed" }),
    regionChoices: z
      .array(regionChoiceSchema)
      .meta({
        description:
          "The countries a language goal can set as `targetRegion` (`PATCH /goals/{goalId}`), named in the goal's language and sorted by name; empty for other goals and languages without countries",
      }),
    status: z.enum(["active", "archived", "completed", "paused"]),
    studyDays: z
      .array(weekdayNumberSchema)
      .meta({ description: "Weekdays with study time, Sunday is 0" }),
    studyTime: z.string().nullable(),
    targetDate: isoDateSchema.nullable(),
    targetLanguage: z.string().nullable(),
    targetRegion: z
      .string()
      .nullable()
      .meta({
        description:
          "A language goal's country, a two-letter code, only when the learner asked for one: name the language with it (\"Spanish (Argentina)\"), and without it name only the language. The buddy and practice calls use its variety; lessons and their audio keep the taught one's (`regionChoices[].taught`)",
      }),
    timezone: z.string().nullable(),
    title: z.string(),
  })
  .meta({ id: "Goal" }) satisfies z.ZodType<GoalView>;

export const goalListResponseSchema = z
  .object({
    activeGoalId: uuidSchema().nullable(),
    dailyMinutes: z.int().meta({ description: "The day's total across active goals" }),
    goals: z
      .array(goalSchema)
      .meta({ description: "The main goal first, then the rest oldest first" }),
  })
  .meta({ id: "GoalList" });

const allowanceLimitSchema = z
  .object({
    limit: z.int(),
    period: z.enum(["day", "month", "total"]),
    resource: z.string().meta({ description: "What ran out, such as goal or activeGoals" }),
    tier: z.enum(["free", "guest", "plus"]),
  })
  .meta({ id: "AllowanceLimit" });

export const goalCreateResponseSchema = z
  .object({
    generations: z
      .array(
        z.object({
          generationId: z.string(),
          goalId: uuidSchema(),
          kind: z
            .enum(["curriculum", "explanation"])
            .meta({
              description:
                "curriculum: skill graph, plan and outlines for learn, exam and language goals; explanation: the quick explanation of an explain question",
            }),
        }),
      )
      .meta({
        description:
          "What is being written for each new goal: stream GET /generations/{generationId}/events for live progress",
      }),
    goals: z.array(goalSchema),
    refused: z
      .array(
        z.object({
          index: z.int().min(0).meta({ description: "The refused goal's place in the request" }),
          limit: allowanceLimitSchema.nullable(),
          retryAfterSeconds: z.int().nullable(),
        }),
      )
      .meta({ description: "Goals the learner's plan didn't allow; the others were created" }),
    research: z
      .array(z.object({ goalId: uuidSchema(), researchId: z.string() }))
      .meta({
        description: "Research started for exam and learn goals: poll GET /research/{researchId}",
      }),
  })
  .meta({ id: "GoalCreateResponse" });

export const replacementGoalResponseSchema = goalCreateResponseSchema
  .pick({ generations: true, research: true })
  .extend({ goal: goalSchema });

export const goalUpdateResponseSchema = z
  .object({
    change: planChangeSchema
      .nullable()
      .meta({ description: "The plan change a new time or date made" }),
    goal: goalSchema,
  })
  .meta({ id: "GoalUpdateResponse" });

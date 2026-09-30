import { type GoalView } from "@zoonk/core/goals/contract";
import { GoalKind } from "@zoonk/db";
import { z } from "zod";
import { planChangeSchema } from "./plans";

const isoDateSchema = z.iso.date();
const SATURDAY = 6;

export const goalSchema = z
  .object({
    createdAt: z.iso.datetime(),
    dailyMinutes: z.int(),
    details: z.record(z.string(), z.unknown()).meta({ description: "What onboarding understood" }),
    examBlueprintId: z.uuid().nullable(),
    id: z.uuid(),
    isActive: z
      .boolean()
      .meta({ description: "The goal the tabs show: the main goal, whose session comes first" }),
    kind: z.enum(GoalKind),
    language: z.string(),
    plan: z
      .object({
        currentPhase: z.int().nullable(),
        endDate: isoDateSchema.nullable(),
        lessonsDone: z.int().min(0),
        lessonsTotal: z.int().min(0),
        phaseCount: z.int().min(0),
        ready: z.boolean().meta({ description: "False while the planner is building the plan" }),
      })
      .nullable(),
    primaryCourseId: z.uuid().nullable(),
    prompt: z.string().meta({ description: "What the learner typed" }),
    status: z.enum(["active", "archived", "completed", "paused"]),
    studyDays: z
      .array(z.int().min(0).max(SATURDAY))
      .meta({ description: "Weekdays with study time, Sunday is 0" }),
    studyTime: z.string().nullable(),
    targetDate: isoDateSchema.nullable(),
    targetLanguage: z.string().nullable(),
    timezone: z.string().nullable(),
    title: z.string(),
  })
  .meta({ id: "Goal" }) satisfies z.ZodType<GoalView>;

export const goalListResponseSchema = z
  .object({
    activeGoalId: z.uuid().nullable(),
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
          goalId: z.uuid(),
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
      .array(z.object({ goalId: z.uuid(), researchId: z.string() }))
      .meta({
        description: "Research started for exam and learn goals: poll GET /research/{researchId}",
      }),
  })
  .meta({ id: "GoalCreateResponse" });

/** A goal that replaces another (the next level, or a language goal's exam) starts like a new one. */
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

import { planChangeSchema } from "@zoonk/core/plans/change-contract";
import { GoalKind } from "@zoonk/db";
import { z } from "zod";
import { examMomentSchema } from "./exams";
import { memoryInsightSchema } from "./memory";
import { planStatusSchema } from "./preparation";
import { todayShortPlanSchema } from "./short-exam-plans";
import { logicalDateSchema, studySessionResponseSchema } from "./study-sessions";
import { suggestedGoalSchema } from "./suggested-goals";

export const todayResponseSchema = z
  .object({
    exam: examMomentSchema
      .nullable()
      .meta({
        description:
          'An exam goal\'s final stretch, day before, exam day or "How did it go?"; null otherwise',
      }),
    goal: z.object({
      dateEstimated: z
        .boolean()
        .meta({ description: "The date is the likely day of an exam whose notice isn't out yet" }),
      daysLeft: z
        .number()
        .int()
        .min(0)
        .nullable()
        .meta({ description: "Whole days until the goal's date; null for a goal without one" }),
      id: z.uuid(),
      kind: z.enum(GoalKind),
      targetDate: logicalDateSchema.nullable(),
      title: z.string(),
    }),
    guardianInvite: z
      .boolean()
      .meta({
        description:
          'A learner under 18 with an account and no guardian invited yet: offer to invite one (POST /v1/me/guardian-links), with "Not now" (POST /v1/me/guardian-invite-dismissals)',
      }),
    insight: memoryInsightSchema
      .nullable()
      .meta({ description: "At most one insight from recent sessions, until it's answered" }),
    lessonStatus: z
      .record(z.uuid(), z.enum(["ready", "generating", "notStarted", "failed"]))
      .meta({
        description:
          "Where each lesson of the day's learn blocks stands; a stop still being written says so. Follow one with `/v1/library/lessons/{lessonId}/readiness`",
      }),
    planChange: planChangeSchema
      .extend({
        chapterTitle: z
          .string()
          .nullable()
          .meta({
            description:
              "For a test-out, the chapter its lessons were skipped from when they all come from one",
          }),
      })
      .nullable()
      .meta({
        description:
          "The plan change to answer on Today: the newest proposal waiting for an OK, or an automatic change of the last day (a rebalance, missed days, a test-out) until it's marked seen. Answer it with PATCH /v1/goals/{goalId}/plan/changes/{changeId}",
      }),
    progress: z
      .object({
        status: planStatusSchema.nullable(),
        value: z.number().min(0).max(1).meta({ description: "Preparation, from 0 to 1" }),
        weekGain: z
          .number()
          .meta({
            description: "Preparation gained since the start of the learner's week (Monday)",
          }),
      })
      .nullable()
      .meta({ description: "Where the plan stands, with preparation and this week's gain" }),
    session: studySessionResponseSchema,
    shortPlan: todayShortPlanSchema,
    studiedToday: z
      .boolean()
      .meta({ description: "Any study time today; a buddy never naps on a day with study" }),
    suggestedGoal: suggestedGoalSchema
      .nullable()
      .meta({
        description:
          "A course the learner was taking before goals existed, offered as another goal to plan until it's answered",
      }),
    weeklyChallenge: z
      .object({
        access: z.enum(["open", "plusRequired"]),
        date: logicalDateSchema.nullable(),
        kind: z.enum(["mixed", "mock"]),
        planItemId: z
          .uuid()
          .meta({
            description: "The challenge's plan item, which opens its intro before and on its day",
          }),
        questions: z.number().int().min(0),
        timeLimitMinutes: z.number().int().min(0).nullable(),
        title: z.string(),
      })
      .nullable()
      .meta({ description: "The goal's next weekly checkpoint: a mock exam or a mixed challenge" }),
  })
  .meta({ id: "Today" });

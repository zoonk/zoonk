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
    insight: memoryInsightSchema
      .nullable()
      .meta({ description: "At most one insight from recent sessions, until it's answered" }),
    lessonStatus: z
      .record(z.uuid(), z.enum(["ready", "generating", "notStarted", "failed"]))
      .meta({
        description:
          "Where each lesson of the day's learn blocks stands; a stop still being written says so. Follow one with `/v1/library/lessons/{lessonId}/readiness`",
      }),
    progress: z
      .object({
        status: planStatusSchema.nullable(),
        value: z.number().min(0).max(1).meta({ description: "Preparation, from 0 to 1" }),
        weekGain: z.number().meta({ description: "Preparation gained over the last seven days" }),
      })
      .nullable()
      .meta({ description: "The status line: plan status and preparation" }),
    reveal: z
      .object({
        missions: z
          .boolean()
          .meta({ description: "Fun shows the three missions from the second study day" }),
      })
      .meta({ description: "What Fun shows yet, so a new learner sees a few things at a time" }),
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
        questions: z.number().int().min(0),
        timeLimitMinutes: z.number().int().min(0).nullable(),
        title: z.string(),
      })
      .nullable()
      .meta({ description: "The goal's next weekly checkpoint: a mock exam or a mixed challenge" }),
  })
  .meta({ id: "Today" });

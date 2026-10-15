import { examChoiceViewSchema } from "@zoonk/core/exams/choices/contract";
import { planChangeSchema } from "@zoonk/core/plans/change-contract";
import { mockFundingSchema } from "@zoonk/core/plans/mock-funding-contract";
import { GoalKind } from "@zoonk/db";
import { z } from "zod";
import { examMomentSchema } from "./exams";
import { memoryInsightSchema } from "./memory";
import { planStatusSchema } from "./preparation";
import { todayShortPlanSchema } from "./short-exam-plans";
import { studyDayResponseSchema } from "./study-day";
import { logicalDateSchema } from "./study-sessions";
import { suggestedGoalSchema } from "./suggested-goals";

export const todayResponseSchema = z
  .object({
    exam: examMomentSchema
      .nullable()
      .meta({
        description:
          'An exam goal\'s final stretch, day before, exam day or "How did it go?"; null otherwise',
      }),
    examChoice: examChoiceViewSchema
      .nullable()
      .meta({
        description:
          "One of the exam's choices the learner hasn't picked yet (ENEM's foreign language), to ask on Today until they do: the plan studies none of its options before. Pick with POST /v1/goals/{goalId}/plan/exam-choices. Null when every choice is picked or the exam has none",
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
        .meta({
          description:
            "Whole days until the goal's date, 0 on the day itself; null for a goal without one and once its date passed",
        }),
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
    mockFunding: mockFundingSchema
      .nullable()
      .describe(
        "Exact saved contribution explaining a lighter study day; null on unrelated days, the mock's own day, and welcome-back sessions, which already explain the lighter day.",
      ),
    planChange: planChangeSchema
      .extend({
        chapterTitle: z
          .string()
          .nullable()
          .meta({
            description:
              "For a test-out, the chapter its lessons were skipped from when they all come from one",
          }),
        id: z
          .uuid()
          .nullable()
          .describe(
            "Null only for a computed mandatory notice before its explicit acknowledgment or Open POST",
          ),
      })
      .nullable()
      .meta({
        description:
          "The plan change to answer on Today: the newest proposal waiting for an OK, or an automatic change of the last day (a rebalance, missed days, a test-out, an estimateUpdated whose net lesson count changed by more than one as the plan adapted to pace data or written lessons) until it's marked seen. Answer it with POST /v1/goals/{goalId}/plan/changes/{changeId}",
      }),
    progress: z
      .discriminatedUnion("measure", [
        z.object({
          measure: z.literal("preparation").meta({ description: "An exam goal" }),
          status: planStatusSchema.nullable(),
          value: z.number().min(0).max(1).meta({ description: "Preparation, from 0 to 1" }),
          weekGain: z
            .number()
            .meta({
              description: "Preparation gained since the start of the learner's week (Monday)",
            }),
        }),
        z.object({
          lessons: z
            .object({
              done: z.number().int().min(0).meta({ description: "Studied or skipped as known" }),
              today: z
                .number()
                .int()
                .min(0)
                .meta({
                  description:
                    "The plan's lessons today's session still holds, each once and only while still to do (one finished in another goal's session no longer counts): what today adds to `done`",
                }),
              total: z.number().int().min(0),
            })
            .meta({ description: "The syllabus's `lessons`: its subjects in the plan, added up" }),
          measure: z.literal("lessons").meta({ description: "Any goal that isn't an exam" }),
          status: planStatusSchema.nullable(),
          value: z
            .number()
            .min(0)
            .max(1)
            .meta({ description: "Progress: `lessons.done` of `lessons.total`, from 0 to 1" }),
        }),
      ])
      .nullable()
      .meta({
        description:
          "Where the plan stands, in the goal's one measure: an exam's preparation with this week's gain, or any other goal's lessons (a language goal shows its level instead, from its Today view). Null for a quick explanation",
      }),
    revision: z
      .string()
      .regex(/^\d+$/u)
      .describe(
        "Viewer revision read before this view; discard stale delivery after a newer revision",
      ),
    session: studyDayResponseSchema,
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
    userId: z
      .uuid()
      .meta({
        description:
          "The authenticated viewer who produced this response. Discard a delayed response if that learner is no longer current.",
      }),
    weeklyChallenge: z
      .object({
        access: z.enum(["open", "plusRequired"]),
        date: logicalDateSchema.nullable(),
        kind: z.enum(["mixed", "mock"]),
        planItemId: z
          .uuid()
          .nullable()
          .meta({
            description:
              "The challenge's saved plan item, or null for selected work that remains visible without an action until Open persists it",
          }),
        questions: z.number().int().min(0),
        timeLimitMinutes: z.number().int().min(0).nullable(),
        title: z.string(),
      })
      .nullable()
      .meta({ description: "The goal's next weekly checkpoint: a mock exam or a mixed challenge" }),
  })
  .meta({ id: "Today" });

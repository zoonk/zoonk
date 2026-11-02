import { examChoiceViewSchema } from "@zoonk/core/exams/choices/contract";
import { planChangeSchema } from "@zoonk/core/plans/change-contract";
import { mockFundingSchema } from "@zoonk/core/plans/mock-funding-contract";
import { noticedPatternSchema } from "@zoonk/core/view-models/language/contract";
import { TODAY_NOTICE_KINDS } from "@zoonk/core/view-models/today/notice";
import { GoalKind } from "@zoonk/db";
import { z } from "zod";
import { lessonGenerationStatusSchema } from "./content-generation";
import { examMomentSchema } from "./exams";
import { memoryInsightSchema } from "./memory";
import { planStatusSchema } from "./preparation";
import { todayShortPlanSchema } from "./short-exam-plans";
import { studyDayResponseSchema } from "./study-day";
import { logicalDateSchema } from "./study-sessions";
import { suggestedGoalSchema } from "./suggested-goals";
import { uploadRequestSchema } from "./upload-request";

export const todayResponseSchema = z
  .object({
    earlierWork: z
      .array(z.object({ id: z.uuid().nullable(), title: z.string() }))
      .describe(
        "Earlier unfinished saved teaching, in plan order. Start settles it into the current plan; this list does not promise it all fits one session.",
      ),
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
      .record(z.uuid(), lessonGenerationStatusSchema)
      .meta({
        description:
          "Where each lesson of the day's learn blocks stands; a stop still being written says so. Follow one with `/v1/library/lessons/{lessonId}/readiness`",
      }),
    mockFunding: mockFundingSchema
      .nullable()
      .describe(
        "Exact saved contribution explaining a lighter study day, welcome-back sessions included; null on unrelated days and the mock's own day.",
      ),
    notice: z
      .enum(TODAY_NOTICE_KINDS)
      .nullable()
      .default(null)
      .meta({
        description:
          "The one notice Today shows, the most pressing first: `exam` (its days and how it went), `examAccess` (a free exam plan's first week ended), `planChange`, `insight`, `sourceChange`, `uploadRequest`, `examChoice`, `practice` (a language goal's noticed pattern or words to say again, from its Today view) or `suggestedGoal`. Keep the one shown while the learner stays, so answering it shows what the answer did; null when nothing needs saying",
      }),
    pattern: noticedPatternSchema
      .nullable()
      .meta({
        description:
          "A language goal's pattern noticed in recent mistakes, not practiced or dismissed yet, offered beside the day; open it with GET /v1/mistake-patterns/{patternId}. Null for any other goal, without one, and when one of the day's missions already opens it, unless a bonus earned on another goal replaced the missions' rows",
      }),
    planChange: planChangeSchema
      .nullable()
      .meta({
        description:
          "The plan change to answer on Today, only when the learner has a say: the newest proposal waiting for an OK, or missed days of the last day that put the goal's date at risk (`behind`) until it's answered. Changes the plan makes on its own (missed days moved forward, closer estimates, test-outs, relearns) stay in the plan's `changes` and aren't Today's news. Answer it with POST /v1/goals/{goalId}/plan/changes/{changeId}",
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
    session: studyDayResponseSchema,
    shortPlan: todayShortPlanSchema,
    sourceChange: z
      .string()
      .nullable()
      .default(null)
      .meta({
        description:
          "The newest change to the source material the goal follows (an exam notice corrected, a source rewritten), in a sentence; null without one",
      }),
    studiedToday: z
      .boolean()
      .meta({ description: "Any study time today; a buddy never naps on a day with study" }),
    suggestedGoal: suggestedGoalSchema
      .nullable()
      .meta({
        description:
          "A course the learner was taking before goals existed, offered as another goal to plan until it's answered",
      }),
    uploadRequest: uploadRequestSchema
      .nullable()
      .default(null)
      .meta({
        description:
          "The official document or class material research couldn't read, asked of the learner until they upload it (POST /v1/uploads, then POST /v1/research with its source) or dismiss it (DELETE /v1/goals/{goalId}/upload-request); null when research needs nothing",
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
        questions: z
          .number()
          .int()
          .min(0)
          .nullable()
          .meta({ description: "Null while the challenge's size is unknown" }),
        timeLimitMinutes: z.number().int().min(0).nullable(),
        title: z.string().nullable().meta({ description: "Null while the challenge has no title" }),
      })
      .nullable()
      .meta({ description: "The goal's next weekly checkpoint: a mock exam or a mixed challenge" }),
  })
  .meta({ id: "Today" });

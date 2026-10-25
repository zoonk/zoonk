import { trueFalseLabelsSchema } from "@zoonk/core/library/exams/true-false-labels";
import { missionSchema, questionAnswerSchema } from "@zoonk/core/sessions/completion-contract";
import { StudyFreshStart, StudySessionStatus } from "@zoonk/db";
import { formatDuration } from "@zoonk/utils/duration";
import { z } from "zod";
import { catchUpSchema } from "./catch-up";
import { checkpointAnsweredQuestionsSchema } from "./checkpoint-evidence";
import { emptyDaySchema, examTomorrowSchema, lessonsComingSchema } from "./day-lessons";
import { listeningTranscriptSchema } from "./item-set";
import { studyBlockSchema } from "./study-block";
import { studyBlockQuestionSchema } from "./study-block-question";

export { studyBlockSchema } from "./study-block";

const EXAMPLE_FUNDED_DAILY_MINUTES = 14.875;
const EXAMPLE_DAILY_MINUTES = 15;
const EXAMPLE_WEEKLY_MINUTES = 105;

export const logicalDateSchema = z.iso.date().meta({ description: "Learner-local calendar date" });
const idSchema = z.uuid();

const hyperdriveSchema = z.object({
  level: z.number().int().min(1),
  streak: z.number().int().min(0),
});

export const extraTimeSchema = z
  .object({
    available: z.boolean(),
    lessons: z
      .array(z.object({ minutes: z.number().int().min(0), title: z.string() }))
      .meta({
        description:
          "The plan's next lessons the time adds, in order, to list them before the tap (\"Up next\"); empty when it adds practice instead (every lesson is done) or isn't available",
      }),
    minutes: z.number().int().min(0),
    reason: z
      .enum(["dailyCap", "dailyLimit", "nothingToStudy", "plusRequired", "sessionNotFinished"])
      .nullable()
      .meta({
        description:
          "Why it isn't offered: the day's two bonus practice blocks are used with no lesson of the plan left to add, the daily time limit leaves too little, nothing is left to practice or learn, a free exam plan's first week is over (its practice and new lessons come with Plus), or the session isn't finished",
      }),
  })
  .meta({ id: "StudyExtraTime" });

const dailyLimitSchema = z
  .object({
    limitMinutes: z.number().int().min(0).nullable(),
    reached: z.boolean(),
    remainingMinutes: z.number().int().min(0).nullable(),
    usedMinutes: z.number().int().min(0),
  })
  .meta({
    description: "The learner's own daily time limit, when they set one",
    id: "DailyTimeLimit",
  });

export const studySessionResponseSchema = z
  .object({
    blocks: z.array(studyBlockSchema),
    brainPower: z.number().int().min(0),
    catchUp: catchUpSchema,
    current: z
      .boolean()
      .meta({
        description:
          "Whether this is the learner's day now: today's session, or the day before's they're still in after midnight. An earlier day's session has nothing left to open; continue with today's",
      }),
    dailyLimit: dailyLimitSchema.nullable(),
    dayEndsAt: z
      .number()
      .int()
      .nonnegative()
      .describe(
        "Epoch milliseconds when this current day gives way, including a carried session after midnight",
      ),
    emptyDay: emptyDaySchema,
    examAccess: z.object({ includesMockExams: z.boolean(), trialEnded: z.boolean() }),
    examTomorrow: examTomorrowSchema,
    extraTime: extraTimeSchema,
    freshStart: z.enum(StudyFreshStart).nullable(),
    fullMeal: z
      .object({ bonus: z.number().int(), earned: z.boolean(), ready: z.boolean() })
      .meta({
        description:
          "The completion bonus for every offered mission: 50 Brain Power whether one, two or three were possible, or 0 when missions is empty. Ready means at least one mission was offered and all are done, counting completions from any supported source. Earned means any goal already paid the bonus for this learner-local date. Payment is once per learner-local day across goals.",
      }),
    goalId: idSchema.nullable(),
    hyperdrive: hyperdriveSchema,
    id: idSchema,
    lessonsComing: lessonsComingSchema,
    localDate: logicalDateSchema,
    minutes: z.object({
      dailyGoal: z
        .number()
        .nonnegative()
        .meta({
          description: `The allocated daily study budget in exact minutes, which may be fractional. Format for display, for example ${formatDuration({ locale: "en", totalSeconds: EXAMPLE_FUNDED_DAILY_MINUTES * 60 })}.`,
          examples: [EXAMPLE_DAILY_MINUTES],
        }),
      done: z
        .number()
        .int()
        .min(0)
        .meta({
          description:
            "The planned minutes of the blocks finished, from each block's estimate: how far the learner is through the day's plan, never the time studied. The time studied today is today's `week.days[].minutes`, as the session summary counts it, and the week's is `week.time.studiedMinutes`",
        }),
      planned: z.number().int().min(0),
    }),
    missions: z
      .array(missionSchema)
      .meta({
        description:
          "Zero to three achievable missions picked and saved when the day's session is built, ordered as Remember, New, Use. Reads update progress without adding or swapping missions. An unfinished mission whose planned anchor was removed is dropped; completed missions stay. A rebuild before any work starts or finishes may pick again. A session still running after midnight keeps its original missions until it ends.",
      }),
    nextBlockId: idSchema.nullable(),
    nextPosition: z.number().int().nonnegative().nullable(),
    pauseSuggested: z.boolean(),
    plusLessons: z
      .array(z.object({ title: z.string() }))
      .meta({
        description:
          "The lessons the plan dates on this day that a free exam plan past its first week holds for Plus, by the title the plan shows. They aren't part of the session: list them after its blocks, locked, with a way to Plus, as Plus learners see them open. Empty on any other plan",
      }),
    sessionBar: z
      .object({ completed: z.number().int().min(0), total: z.number().int().min(0) })
      .meta({ description: "One step per block still in the day, filled as blocks are done" }),
    status: z.enum(StudySessionStatus),
    week: z
      .object({
        days: z.array(
          z.object({
            date: logicalDateSchema,
            goalMinutes: z
              .number()
              .min(0)
              .meta({
                description:
                  "What the learner's plans give the day; 0 on a day without study. Exact minutes may be fractional; format them as a human duration for display.",
                examples: [EXAMPLE_DAILY_MINUTES],
              }),
            hitGoal: z.boolean(),
            isToday: z.boolean(),
            kind: z
              .enum(["afterEnd", "beforeStart", "deadline", "exam", "rest", "study"])
              .meta({
                description:
                  "What the learner's plans make of the day: a study day, a rest day they chose, an exam's day or another goal's date, or a day with nothing planned before they began (`beforeStart`) or after every one of their dates (`afterEnd`). A plan whose date came with lessons left goes on once the learner moves its date, so say an `afterEnd` day is after their date, never that their plan ended",
              }),
            minutes: z
              .number()
              .int()
              .min(0)
              .meta({
                description:
                  "The time the learner actually studied that day, rounded down to whole minutes, as the session summary counts it",
              }),
            studied: z.boolean().meta({ description: "Any study counts, partial days included" }),
          }),
        ),
        daysHitGoal: z.number().int().min(0),
        nextStudyDate: logicalDateSchema
          .nullable()
          .meta({
            description:
              "The learner's next day with study time after today, within a week and past the week's end: when today's study time used up is back. Say tomorrow when it's the next day, else name the day; null when the coming week has none (say the next session)",
          }),
        studyDays: z
          .number()
          .int()
          .min(0)
          .meta({ description: "Days of the week with a time goal" }),
        time: z.object({
          studiedMinutes: z
            .number()
            .int()
            .min(0)
            .meta({
              description:
                "Actual recorded study seconds this week, summed before rounding down to minutes",
            }),
          targetMinutes: z
            .number()
            .min(0)
            .meta({
              description:
                "The learner's shared weekly time budget across active goals, including past session targets. Exact minutes may be fractional; format them as a human duration for display.",
              examples: [EXAMPLE_WEEKLY_MINUTES],
            }),
        }),
      })
      .meta({
        description:
          "The week containing the session's localDate on session reads. Today returns the current learner-local week, even when a session carries over midnight with its original localDate",
      }),
  })
  .meta({ id: "StudySession" });

export const studyBlockDetailResponseSchema = z
  .object({
    answeredQuestions: checkpointAnsweredQuestionsSchema,
    block: studyBlockSchema,
    hints: z.boolean().meta({ description: "False in checkpoints: a duel without hints" }),
    questions: z.array(studyBlockQuestionSchema),
    trueFalseLabels: trueFalseLabelsSchema,
  })
  .meta({ id: "StudyBlockDetail" });

export const startedStudyBlockResponseSchema = z
  .object({
    id: idSchema,
    kind: studyBlockSchema.shape.kind,
    lessonId: idSchema.nullable(),
    startedAt: z.iso.datetime().nullable(),
    status: studyBlockSchema.shape.status,
  })
  .meta({ id: "StartedStudyBlock" });

export const studyAnswerFeedbackResponseSchema = z
  .object({
    blank: z
      .boolean()
      .meta({
        description:
          "A statement left blank (`{ dontKnow: true }`) where a wrong answer cancels a right one: neither right nor a mistake, so show it as left blank, not as an error. It isn't saved as a mistake",
      }),
    correctAnswer: questionAnswerSchema
      .nullable()
      .meta({ description: "Null in checkpoints until they end" }),
    explanation: z.string().nullable(),
    hyperdrive: hyperdriveSchema,
    isCorrect: z.boolean(),
    mistakeFixed: z.boolean(),
    pauseSuggested: z.boolean(),
    reinforcementLessons: z
      .number()
      .int()
      .min(0)
      .nullable()
      .meta({
        description:
          "Actual available reinforcement lessons for the checkpoint's misses, using the same selection as the rematch scheduler; null for other blocks",
      }),
    savedToNotebook: z.boolean(),
    transcript: listeningTranscriptSchema.meta({
      description:
        "A recording's transcript (who said what, in order) once this answer completes its questions in the block; null otherwise, and always before, since it would answer them",
    }),
    trap: z
      .string()
      .nullable()
      .meta({
        description:
          "In a trap drill, the misconception matching the wrong answer; null for correct, unknown, or unmatched answers",
      }),
    workedSteps: z
      .array(z.string())
      .meta({
        description:
          "A math problem's worked steps with the numbers it showed; empty for other questions and in checkpoints until they end",
      }),
  })
  .meta({ id: "StudyAnswerFeedback" });

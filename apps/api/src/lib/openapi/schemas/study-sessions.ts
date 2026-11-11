import { trueFalseLabelsSchema } from "@zoonk/core/library/exams/true-false-labels";
import { studyBlockSchema } from "@zoonk/core/sessions/block-view-contract";
import { missionSchema, questionAnswerSchema } from "@zoonk/core/sessions/completion-contract";
import { sessionMinutesSchema } from "@zoonk/core/sessions/session-minutes";
import { StudyFreshStart, StudySessionStatus } from "@zoonk/db";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { catchUpSchema } from "./catch-up";
import { checkpointAnsweredQuestionsSchema } from "./checkpoint-evidence";
import {
  dayStateSchema,
  emptyDaySchema,
  examTomorrowSchema,
  lessonsComingSchema,
  lessonsToPrepareSchema,
} from "./day-lessons";
import { listeningTranscriptSchema } from "./item-set";
import { studyBlockQuestionSchema } from "./study-block-question";

const EXAMPLE_DAILY_MINUTES = 15;

export const logicalDateSchema = z.iso.date().meta({ description: "Learner-local calendar date" });
const idSchema = uuidSchema();

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
      .enum(["dayOver", "nothingToStudy", "plusRequired", "sessionNotFinished"])
      .nullable()
      .meta({
        description:
          "Why it isn't offered: the session's day is over (more time goes to today's), nothing is left to practice or learn, a free exam plan's first week is over (its practice and new lessons come with Plus), or the session isn't finished",
      }),
  })
  .meta({ id: "StudyExtraTime" });

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
          "The completion bonus for every offered mission: 50 Brain Power whether one, two or three were possible, or 0 when missions is empty. Ready means at least one mission was offered and all are done, counting this goal's completions from any supported source. Earned means this day already paid the bonus. Each goal's day pays its own bonus once.",
      }),
    goalId: idSchema.nullable(),
    hyperdrive: hyperdriveSchema,
    id: idSchema,
    lessonsComing: lessonsComingSchema,
    lessonsToPrepare: lessonsToPrepareSchema,
    localDate: logicalDateSchema,
    minutes: sessionMinutesSchema,
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
    state: dayStateSchema,
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
                  "What this goal's plan gives the day; 0 on a day without study. Past a free exam goal's free week, a day counts only what its saved or planned session holds, and a later day counts nothing. Exact minutes may be fractional; format them as a human duration for display.",
                examples: [EXAMPLE_DAILY_MINUTES],
              }),
            hitGoal: z.boolean(),
            isToday: z.boolean(),
            kind: z
              .enum(["afterEnd", "beforeStart", "deadline", "exam", "rest", "study"])
              .meta({
                description:
                  "What this goal's plan makes of the day: a study day, a rest day they chose, the exam's day or the goal's date, or a day with nothing planned before the goal began (`beforeStart`) or after its date (`afterEnd`). A plan whose date came with lessons left goes on once the learner moves its date, so say an `afterEnd` day is after their date, never that their plan ended",
              }),
            minutes: z
              .number()
              .int()
              .min(0)
              .meta({
                description:
                  "The time the learner actually studied this goal that day, rounded down to whole minutes, as the session summary counts it",
              }),
            studied: z
              .boolean()
              .meta({ description: "Any study of this goal counts, partial days included" }),
          }),
        ),
        nextStudyDate: logicalDateSchema
          .nullable()
          .meta({
            description:
              "This goal's next scheduled study day after today, within a week and past the week's end. Say tomorrow when it's the next day, else name the day; null when the coming week has none (say the next session)",
          }),
      })
      .meta({
        description:
          "The session's goal's week, never another goal's: the week containing the session's localDate on session reads. Today returns the current learner-local week, even when a session carries over midnight with its original localDate",
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

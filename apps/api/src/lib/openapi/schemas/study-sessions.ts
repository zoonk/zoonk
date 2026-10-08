import { trueFalseLabelsSchema } from "@zoonk/core/library/exams/true-false-labels";
import { missionSchema, questionAnswerSchema } from "@zoonk/core/sessions/completion-contract";
import { StudyBlockKind, StudyBlockStatus, StudyFreshStart, StudySessionStatus } from "@zoonk/db";
import { z } from "zod";
import { catchUpSchema } from "./catch-up";
import { itemCitationSchema, questionImageSchema, questionVisualSchema } from "./common";
import { emptyDaySchema, lessonsComingSchema } from "./day-lessons";
import { mistakeDrillSchema } from "./mistakes";

export const logicalDateSchema = z.iso.date().meta({ description: "Learner-local calendar date" });
const idSchema = z.uuid();

const hyperdriveSchema = z.object({
  level: z.number().int().min(1),
  streak: z.number().int().min(0),
});

const checkpointSchema = z
  .object({
    kind: z
      .enum(["boss", "finalBoss", "weekly"])
      .meta({
        description:
          "A phase boss, the final boss that closes the plan, or the weekly Big Challenge",
      }),
    mock: z
      .boolean()
      .meta({ description: "An exam's weekly mock, which feeds the estimated score" }),
    passMark: z
      .number()
      .int()
      .min(0)
      .meta({ description: "Right answers needed to win: seven of ten" }),
    phase: z.number().int().min(0).nullable(),
    rematch: z.boolean().meta({ description: "A boss lost on an earlier day, back again" }),
    timeLimitMinutes: z.number().int().min(0).nullable(),
  })
  .meta({ id: "StudyCheckpoint" });

export const studyBlockSchema = z
  .object({
    answered: z.number().int().min(0),
    brainPower: z.number().int().min(0).meta({ description: "Brain Power the block earned" }),
    canDo: z.string().nullable().meta({ description: "What the learner will be able to do" }),
    capsules: z.array(
      z.object({
        format: z.enum(["rapidFire", "matchPairs", "swipe"]),
        key: z.string(),
        lessonId: idSchema.nullable(),
        opened: z.boolean(),
        questions: z.number().int().min(0),
        title: z.string(),
      }),
    ),
    chapterId: idSchema
      .nullable()
      .meta({ description: "A chapter whose lesson is written just in time" }),
    checkpoint: checkpointSchema.nullable(),
    estimatedBrainPower: z.number().int().min(0),
    estimatedMinutes: z.number().int().min(0),
    extra: z.boolean().meta({ description: 'A "10 more minutes" block after the day\'s session' }),
    fullReview: z
      .boolean()
      .meta({
        description: "A full review: every topic, in place of a mock the plan doesn't have",
      }),
    id: idSchema,
    kind: z.enum(StudyBlockKind),
    lessonId: idSchema.nullable(),
    netScored: z
      .boolean()
      .meta({
        description:
          "Practice scored net (a wrong answer cancels a right one, as in Cebraspe exams): statements can be answered with dontKnow to leave them blank. Swipe capsules are scored net on their own",
      }),
    oftenTested: z
      .boolean()
      .meta({
        description: "An exam topic the board asks a lot in past papers: tiles tag it Often tested",
      }),
    planItemId: idSchema.nullable(),
    position: z.number().int().min(0),
    questions: z.number().int().min(0),
    reinforcement: z.boolean().meta({ description: "A short lesson before a boss rematch" }),
    status: z.enum(StudyBlockStatus),
    subject: z
      .string()
      .nullable()
      .meta({
        description:
          "The goal's subject the block studies, by its short name (as `GET /v1/goals/{goalId}/syllabus` names it): label the block with it. Null for blocks that mix subjects, and for goals with fewer than two subjects",
      }),
    title: z.string().nullable(),
  })
  .meta({ id: "StudyBlock" });

export const extraTimeSchema = z
  .object({
    available: z.boolean(),
    minutes: z.number().int().min(0),
    reason: z
      .enum(["dailyCap", "dailyLimit", "nothingToStudy", "sessionNotFinished"])
      .nullable()
      .meta({
        description:
          "Why it isn't offered: the day's two bonus blocks are used, the daily time limit leaves too little, nothing is left to practice or learn, or the session isn't finished",
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
    description:
      "The daily time limit, when the learner or a guardian set one: the strictest applies",
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
    emptyDay: emptyDaySchema,
    examAccess: z.object({ includesMockExams: z.boolean(), trialEnded: z.boolean() }),
    extraTime: extraTimeSchema,
    freshStart: z.enum(StudyFreshStart).nullable(),
    fullMeal: z.object({ bonus: z.number().int(), earned: z.boolean(), ready: z.boolean() }),
    goalId: idSchema.nullable(),
    hyperdrive: hyperdriveSchema,
    id: idSchema,
    lessonsComing: lessonsComingSchema,
    localDate: logicalDateSchema,
    minutes: z.object({
      dailyGoal: z.number().int().min(0),
      done: z.number().int().min(0),
      planned: z.number().int().min(0),
    }),
    missions: z.array(missionSchema),
    nextBlockId: idSchema.nullable(),
    pauseSuggested: z.boolean(),
    sessionBar: z
      .object({ completed: z.number().int().min(0), total: z.number().int().min(0) })
      .meta({ description: "One step per block still in the day, filled as blocks are done" }),
    status: z.enum(StudySessionStatus),
    week: z.object({
      days: z.array(
        z.object({
          date: logicalDateSchema,
          goalMinutes: z
            .number()
            .int()
            .min(0)
            .meta({
              description: "What the learner's plans give the day; 0 on a day without study",
            }),
          hitGoal: z.boolean(),
          isToday: z.boolean(),
          kind: z
            .enum(["afterEnd", "beforeStart", "deadline", "exam", "rest", "study"])
            .meta({
              description:
                "What the learner's plans make of the day: a study day, a rest day they chose, an exam's day or another goal's date, or a day outside their plans (before they began or after their date)",
            }),
          minutes: z.number().int().min(0),
          studied: z.boolean().meta({ description: "Any study counts, partial days included" }),
        }),
      ),
      daysHitGoal: z.number().int().min(0),
      studyDays: z.number().int().min(0).meta({ description: "Days of the week with a time goal" }),
    }),
  })
  .meta({ id: "StudySession" });

export const studyBlockDetailResponseSchema = z
  .object({
    block: studyBlockSchema,
    hints: z.boolean().meta({ description: "False in checkpoints: a duel without hints" }),
    questions: z.array(
      z.object({
        answered: z
          .object({
            blank: z
              .boolean()
              .meta({
                description:
                  "Left blank where a wrong answer cancels a right one: counts as neither",
              }),
            isCorrect: z.boolean(),
          })
          .nullable(),
        capsuleKey: z.string().nullable(),
        citation: itemCitationSchema.meta({
          description: "The passage it quotes, such as an article of law, with its dated source",
        }),
        context: z.string().nullable(),
        drill: mistakeDrillSchema
          .nullable()
          .meta({ description: "A saved mistake's drill, played the way its cause calls for" }),
        format: z
          .enum(["multipleChoice", "trueFalse", "matchPairs", "numeric"])
          .meta({
            description:
              "numeric: a math problem, answered with a number. Its numbers are drawn for this block, so they stay the same on every visit and change in the next block that asks it",
          }),
        image: questionImageSchema,
        itemId: idSchema,
        left: z.array(z.string()).nullable().meta({ description: "Match pairs: the left column" }),
        mistakeId: idSchema.nullable(),
        options: z.array(z.string()).nullable(),
        placement: z
          .boolean()
          .meta({
            description:
              "A placement question of the goal's first week: it fine-tunes where the plan starts, is never saved as a mistake, and welcomes `{ dontKnow: true }`",
          }),
        question: z.string(),
        quoted: z
          .boolean()
          .meta({
            description:
              "A real past exam question copied as printed, where its organizer allows it: show `citation` with it before it's answered",
          }),
        right: z
          .array(z.string())
          .nullable()
          .meta({ description: "Match pairs: the right column" }),
        skillId: idSchema,
        timeMachine: z
          .object({
            answer: z.string().nullable(),
            answeredAt: z.iso.datetime(),
            isCorrect: z.boolean(),
          })
          .nullable()
          .meta({
            description:
              "The learner's last answer to this question before today: when, and whether it was right. `answer` holds its text only when it was wrong, so it never gives today's answer away; show it after the learner answers. A math answer given with other numbers has no answer text",
          }),
        unit: z
          .object({
            position: z
              .enum(["prefix", "suffix"])
              .meta({ description: "Where the unit goes: before the number for money (R$ 45)" }),
            symbol: z.string(),
          })
          .nullable()
          .meta({ description: "A math problem's unit, shown next to the answer field" }),
        visual: questionVisualSchema,
      }),
    ),
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
    savedToNotebook: z.boolean(),
    trap: z
      .string()
      .nullable()
      .meta({ description: "In a trap drill, the trap the question set, named after the answer" }),
    workedSteps: z
      .array(z.string())
      .meta({
        description:
          "A math problem's worked steps with the numbers it showed; empty for other questions and in checkpoints until they end",
      }),
  })
  .meta({ id: "StudyAnswerFeedback" });

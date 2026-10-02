import { trueFalseLabelsSchema } from "@zoonk/core/library/exams/true-false-labels";
import { missionSchema, questionAnswerSchema } from "@zoonk/core/sessions/completion-contract";
import { StudyBlockKind, StudyBlockStatus, StudyFreshStart, StudySessionStatus } from "@zoonk/db";
import { z } from "zod";
import { mistakeDrillSchema } from "./mistakes";

export const logicalDateSchema = z.iso.date().meta({ description: "Learner-local calendar date" });
const idSchema = z.uuid();

const hyperdriveSchema = z.object({
  level: z.number().int().min(1),
  streak: z.number().int().min(0),
});

/** A question's dated "Sources" chip: the passage it quotes and the document it comes from. */
export const itemCitationSchema = z
  .object({
    checkedAt: z.iso
      .datetime()
      .nullable()
      .meta({
        description:
          'When the source was last fetched and found current ("Checked Sep 2026"); null when the passage has no stored source',
      }),
    publisher: z.string().nullable(),
    text: z
      .string()
      .meta({ description: 'The passage it quotes, such as "Lei nº 8.112, Art. 13"' }),
    title: z.string().nullable().meta({ description: "The source document's title" }),
    url: z.string().nullable().meta({ description: "The official text, when it's online" }),
  })
  .nullable();

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
    title: z.string().nullable(),
  })
  .meta({ id: "StudyBlock" });

export const extraTimeSchema = z
  .object({
    available: z.boolean(),
    minutes: z.number().int().min(0),
    reason: z.enum(["dailyCap", "dailyLimit", "sessionNotFinished"]).nullable(),
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
    dailyLimit: dailyLimitSchema.nullable(),
    examAccess: z.object({ includesMockExams: z.boolean(), trialEnded: z.boolean() }),
    extraTime: extraTimeSchema,
    freshStart: z.enum(StudyFreshStart).nullable(),
    fullMeal: z.object({ bonus: z.number().int(), earned: z.boolean(), ready: z.boolean() }),
    goalId: idSchema.nullable(),
    hyperdrive: hyperdriveSchema,
    id: idSchema,
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
            .meta({ description: "What the learner's plans give the day; 0 on a rest day" }),
          hitGoal: z.boolean(),
          isToday: z.boolean(),
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
        answered: z.object({ isCorrect: z.boolean() }).nullable(),
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
              "The learner's last answer to this question before today. A math answer given with other numbers has no answer text",
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

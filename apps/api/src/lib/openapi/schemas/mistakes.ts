import { trueFalseLabelsSchema } from "@zoonk/core/library/exams/true-false-labels";
import { mistakeListInputSchema } from "@zoonk/core/mistakes/contract";
import { MISTAKE_DRILL_KINDS } from "@zoonk/core/mistakes/drills";
import { mistakeSnapshotSchema } from "@zoonk/core/mistakes/snapshot";
import { MistakeCause, MistakeStatus } from "@zoonk/db";
import { z } from "zod";
import { paginationSchema } from "./common";
import { bankQuestionSchema } from "./learner";

const mistakeCauseSchema = z
  .enum(MistakeCause)
  .meta({
    description: "Content gap, misread, trap, ran out of time or guessed",
    id: "MistakeCause",
  });

const mistakeStatusSchema = z.enum(MistakeStatus).meta({ id: "MistakeStatus" });

const mistakeSchema = z
  .object({
    cause: mistakeCauseSchema
      .nullable()
      .meta({ description: "Null while the cause is being named" }),
    createdAt: z.iso.datetime(),
    fixedAt: z.iso.datetime().nullable(),
    id: z.uuid(),
    itemId: z.uuid().nullable(),
    skill: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    snapshot: mistakeSnapshotSchema,
    status: mistakeStatusSchema,
  })
  .meta({ id: "Mistake" });

export const mistakeListQuerySchema = mistakeListInputSchema
  .omit({ offset: true })
  .extend({
    cursor: z.string().optional().meta({ description: "Opaque cursor returned in nextCursor" }),
  })
  .meta({ id: "MistakeListQuery" });

export const mistakeListResponseSchema = z
  .object({
    counts: z.object({
      byCause: z.object({
        gap: z.number().int().min(0),
        guess: z.number().int().min(0),
        misread: z.number().int().min(0),
        time: z.number().int().min(0),
        trap: z.number().int().min(0),
        unsorted: z.number().int().min(0),
      }),
      fixed: z.number().int().min(0),
      open: z.number().int().min(0),
    }),
    data: z.array(mistakeSchema),
    pagination: paginationSchema,
    trueFalseLabels: trueFalseLabelsSchema.meta({
      description:
        "How true-or-false answers read: the goal's exam's with `goalId`, `trueFalse` without one",
    }),
  })
  .meta({ id: "MistakeList" });

/** How a mistake's drill plays, by its cause: in "Practice mistakes" and in today's practice. */
export const mistakeDrillSchema = z
  .object({
    kind: z
      .enum(MISTAKE_DRILL_KINDS)
      .meta({
        description:
          "The practice the mistake's cause calls for: reteach (content gap: the lesson's idea first), readCarefully (misread: read the whole question before the answers), spotTheTrap (trap: the trap is named after each answer), timed (ran out of time: a time box per question), noGuessing (guess: an honest \"I'm not sure\" instead of a guess), retry (cause not known yet)",
      }),
    lesson: z
      .object({
        id: z.uuid(),
        ideas: z
          .array(z.string())
          .meta({ description: "The lesson's summary card, one idea each" }),
        title: z.string(),
      })
      .nullable()
      .meta({ description: "The lesson to go over before the questions, for a content gap" }),
    timeLimitSeconds: z
      .number()
      .int()
      .min(1)
      .nullable()
      .meta({
        description:
          "Seconds per question in a timed drill. An answer that takes them all counts as wrong; send dontKnow when time runs out",
      }),
  })
  .meta({ id: "MistakeDrill" });

export const mistakePracticeResponseSchema = z
  .object({
    practice: z.array(
      z.object({
        cause: mistakeCauseSchema.nullable(),
        drill: mistakeDrillSchema,
        mistakeId: z.uuid(),
        questions: z.array(bankQuestionSchema).meta({ description: "The original question first" }),
        snapshot: mistakeSnapshotSchema,
      }),
    ),
    trueFalseLabels: trueFalseLabelsSchema.meta({
      description:
        "How true-or-false statements are answered: the goal's exam's with `goalId`, `trueFalse` without one",
    }),
  })
  .meta({ id: "MistakePractice" });

export const mistakePracticeFeedbackSchema = z
  .object({
    answerId: z
      .uuid()
      .meta({ description: "The answer's id: send the run's answer ids when it finishes" }),
    correctAnswer: z.union([
      z.object({ selectedIndex: z.number().int().min(0) }),
      z.object({ isTrue: z.boolean() }),
    ]),
    explanation: z.string().nullable(),
    isCorrect: z.boolean(),
    mistakeStatus: mistakeStatusSchema.meta({
      description: "Fixed once answered right on a later day",
    }),
    trap: z
      .string()
      .nullable()
      .meta({ description: "In a trap drill, the trap the question set, named after the answer" }),
  })
  .meta({ id: "MistakePracticeFeedback" });

export const mistakePracticeCompletionSchema = z
  .object({
    brainPower: z.number().int().min(0).meta({ description: "Brain Power the run earned" }),
    correct: z.number().int().min(0),
    seconds: z.number().int().min(0).meta({ description: "Learning time the run added to today" }),
    total: z.number().int().min(0).meta({ description: "Answers the run counted" }),
  })
  .meta({ id: "MistakePracticeCompletion" });

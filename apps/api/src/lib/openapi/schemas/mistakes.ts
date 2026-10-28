import { trueFalseLabelsSchema } from "@zoonk/core/library/exams/true-false-labels";
import { mistakeAvailabilitySchema, mistakeListInputSchema } from "@zoonk/core/mistakes/contract";
import { MISTAKE_DRILL_KINDS } from "@zoonk/core/mistakes/drills";
import { mistakeSnapshotSchema } from "@zoonk/core/mistakes/snapshot";
import {
  activityBrainPowerSchema,
  missionMomentSchema,
} from "@zoonk/core/sessions/completion-contract";
import { progressCelebrationShape } from "@zoonk/core/sessions/progress-celebration";
import { reachedSchema } from "@zoonk/core/sessions/reached";
import { MistakeCause, MistakeStatus } from "@zoonk/db";
import { z } from "zod";
import { bankQuestionWith } from "./bank-question-with";
import { paginationSchema } from "./common";
import { itemSetSchema } from "./item-set";

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
    lesson: z
      .object({ id: z.uuid(), title: z.string() })
      .nullable()
      .meta({
        description:
          'The lesson "Open the lesson" opens: the one the mistake was made in; for a question answered outside a lesson, the first teaching lesson the learner completed, otherwise the first written (already generated) teaching lesson, otherwise the current first teaching lesson. Only lessons the learner can open qualify; null when there is none',
      }),
    practiceAvailable: z
      .boolean()
      .meta({
        description:
          "Open and made on an earlier learner-local day; today's mistakes become available tomorrow",
      }),
    practiceAvailableTomorrow: z
      .boolean()
      .meta({
        description:
          "This open mistake has drill material and becomes available on the next learner-local day",
      }),
    skill: z
      .object({ id: z.uuid(), name: z.string() })
      .nullable()
      .meta({
        description:
          'Its skill; "Practice this skill" is `GET /me/mistake-practice` with its `skillId`',
      }),
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
    availability: mistakeAvailabilitySchema,
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
          "The practice the mistake's cause calls for: reteach (content gap: the lesson's idea first), readCarefully (misread: read the whole question before the answers), spotTheTrap (trap: only the trap matching a wrong answer is named), timed (ran out of time: a time box per question), noGuessing (guess: an honest \"I'm not sure\" instead of a guess), retry (cause not known yet)",
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

/** A drill's question, with the passage, case, chart or recording it was asked with. */
const mistakeQuestionSchema = bankQuestionWith({
  set: itemSetSchema
    .nullable()
    .meta({
      description:
        "The passage, case, chart or recording the question was asked with: show it above the question; null for a question on its own",
    }),
});

export const mistakePracticeResponseSchema = z
  .object({
    practice: z.array(
      z.object({
        cause: mistakeCauseSchema.nullable(),
        drill: mistakeDrillSchema,
        mistakeId: z.uuid(),
        questions: z
          .array(mistakeQuestionSchema)
          .meta({ description: "The original question first" }),
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
      z.object({ selectedIndexes: z.array(z.number().int().min(0)) }),
      z.object({ isTrue: z.boolean() }),
    ]),
    explanation: z.string().nullable(),
    fixed: z.boolean().meta({ description: "This answer fixed the practiced notebook entry" }),
    fixedMistakeIds: z
      .array(z.uuid())
      .meta({
        description:
          "Every notebook entry fixed by this answer; deduplicate these for the run correction count",
      }),
    isCorrect: z.boolean(),
    mistakeStatus: mistakeStatusSchema.meta({
      description: "Fixed once answered right on a later day",
    }),
    reached: reachedSchema.meta({
      description:
        "What counting the run with this answer reached (a belt level, a tenth of Energy), when the answer came with its run: the run counts as it goes, so its end celebrates what each answer's count reached together with the completion's own",
    }),
    trap: z
      .string()
      .nullable()
      .meta({
        description:
          "In a trap drill, the misconception matching the wrong answer; null for correct, unknown, or unmatched answers",
      }),
  })
  .meta({ id: "MistakePracticeFeedback" });

export const mistakePracticeCompletionSchema = z
  .object({
    ...progressCelebrationShape,
    brainPower: activityBrainPowerSchema,
    correct: z.number().int().min(0),
    missionMoment: missionMomentSchema.nullable(),
    seconds: z.number().int().min(0).meta({ description: "Learning time the run added to today" }),
    total: z.number().int().min(0).meta({ description: "Answers the run counted" }),
  })
  .meta({ id: "MistakePracticeCompletion" });

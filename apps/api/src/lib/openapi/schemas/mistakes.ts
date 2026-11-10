import { trueFalseLabelsSchema } from "@zoonk/core/library/exams/true-false-labels";
import { mistakeAvailabilitySchema, mistakeListInputSchema } from "@zoonk/core/mistakes/contract";
import { mistakeSnapshotSchema } from "@zoonk/core/mistakes/snapshot";
import {
  activityBrainPowerSchema,
  missionMomentSchema,
} from "@zoonk/core/sessions/completion-contract";
import { progressCelebrationShape } from "@zoonk/core/sessions/progress-celebration";
import { CourseLevel, MistakeCause, MistakeStatus } from "@zoonk/db";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { paginationSchema } from "./common";
import { playableStepSchema } from "./library-lessons";
import { mistakeDrillSchema } from "./mistake-drill";
import { studyBlockQuestionSchema } from "./study-block-question";

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
    id: uuidSchema(),
    itemId: uuidSchema().nullable(),
    lesson: z
      .object({ id: uuidSchema(), title: z.string() })
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
      .object({ id: uuidSchema(), name: z.string() })
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

const mistakeQuestionSchema = studyBlockQuestionSchema.pick({
  context: true,
  entry: true,
  format: true,
  image: true,
  itemId: true,
  left: true,
  options: true,
  question: true,
  right: true,
  select: true,
  set: true,
  skillId: true,
  unit: true,
  visual: true,
});

export const mistakePracticeResponseSchema = z
  .object({
    practice: z.array(
      z.object({
        cause: mistakeCauseSchema.nullable(),
        drill: mistakeDrillSchema,
        lesson: z
          .object({
            language: z.string(),
            lessonId: uuidSchema(),
            level: z.enum(CourseLevel),
            step: playableStepSchema,
            targetLanguage: z.string().nullable(),
          })
          .nullable(),
        mistakeId: uuidSchema(),
        questions: z
          .array(mistakeQuestionSchema)
          .meta({ description: "The question to answer: the mistake's own while it can be asked" }),
        snapshot: mistakeSnapshotSchema,
        tutorAvailable: z.boolean(),
      }),
    ),
    trueFalseLabels: trueFalseLabelsSchema.meta({
      description:
        "How true-or-false statements are answered: the goal's exam's with `goalId`, `trueFalse` without one",
    }),
  })
  .meta({ id: "MistakePractice" });

export { mistakePracticeFeedbackSchema } from "@zoonk/core/mistakes/practice-feedback";

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

import { z } from "zod";
import { createSelectedAnswerSchema } from "../player/contracts/_utils/selected-answer-schema";

export const MAX_LESSON_QUESTION_LENGTH = 2000;
export const MAX_LESSON_QUESTION_CONTEXT_STEPS = 50;
export const MAX_LESSON_QUESTION_THREAD_TURNS = 50;

const MAX_LESSON_QUESTION_STEP_NUMBER = 2_147_483_647;

const MAX_LESSON_QUESTION_ANSWER_ITEMS = 50;

const MAX_LESSON_QUESTION_ANSWER_TEXT_LENGTH = 500;

const MAX_LESSON_QUESTION_ANSWER_MISTAKES = 50;

const lessonQuestionThreadCursorSchema = z.uuid();

export const getLessonQuestionThreadInputSchema = z
  .object({ cursor: lessonQuestionThreadCursorSchema.optional() })
  .strict();

const lessonQuestionSelectedAnswerSchema = createSelectedAnswerSchema({
  maxItems: MAX_LESSON_QUESTION_ANSWER_ITEMS,
  maxMistakes: MAX_LESSON_QUESTION_ANSWER_MISTAKES,
  maxTextLength: MAX_LESSON_QUESTION_ANSWER_TEXT_LENGTH,
});

const lessonQuestionLessonContextInputSchema = z
  .object({
    kind: z.literal("lesson"),
    stepIds: z.array(z.uuid()).max(MAX_LESSON_QUESTION_CONTEXT_STEPS).optional(),
  })
  .strict();

/**
 * The player can shuffle and subset steps, so only the client knows the learner-visible ordinal.
 * This number is presentation metadata; Core still resolves every content-bearing field by step ID.
 */
const lessonQuestionStepNumberSchema = z.number().int().min(1).max(MAX_LESSON_QUESTION_STEP_NUMBER);

const lessonQuestionStepContextInputSchema = z
  .object({ kind: z.literal("step"), stepId: z.uuid(), stepNumber: lessonQuestionStepNumberSchema })
  .strict();

const lessonQuestionAnswerContextInputSchema = z
  .object({
    answer: lessonQuestionSelectedAnswerSchema,
    kind: z.literal("answer"),
    stepId: z.uuid(),
    stepNumber: lessonQuestionStepNumberSchema,
  })
  .strict();

export const lessonQuestionContextInputSchema = z.discriminatedUnion("kind", [
  lessonQuestionLessonContextInputSchema,
  lessonQuestionStepContextInputSchema,
  lessonQuestionAnswerContextInputSchema,
]);

export const createLessonQuestionInputSchema = z
  .object({
    context: lessonQuestionContextInputSchema,
    question: z.string().trim().min(1).max(MAX_LESSON_QUESTION_LENGTH),
    requestId: z.uuid(),
  })
  .strict();

const lessonQuestionContextSummarySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("lesson") }).strict(),
  z
    .object({
      kind: z.literal("step"),
      stepId: z.uuid().nullable(),
      stepNumber: lessonQuestionStepNumberSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("answer"),
      stepId: z.uuid().nullable(),
      stepNumber: lessonQuestionStepNumberSchema,
    })
    .strict(),
]);

export const lessonQuestionResourceSchema = z
  .object({
    answer: z.string().nullable(),
    context: lessonQuestionContextSummarySchema,
    createdAt: z.iso.datetime(),
    id: z.uuid(),
    question: z.string(),
    status: z.enum(["pending", "running", "completed", "failed"]),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const lessonQuestionThreadResourceSchema = z
  .object({
    hasMore: z.boolean(),
    id: z.uuid(),
    lessonId: z.uuid().nullable(),
    nextCursor: lessonQuestionThreadCursorSchema.nullable(),
    questions: z.array(lessonQuestionResourceSchema),
  })
  .strict();

export const lessonQuestionThreadResponseSchema = lessonQuestionThreadResourceSchema.nullable();

export type CreateLessonQuestionInput = z.infer<typeof createLessonQuestionInputSchema>;
export type GetLessonQuestionThreadInput = z.infer<typeof getLessonQuestionThreadInputSchema>;
export type LessonQuestionContextInput = z.infer<typeof lessonQuestionContextInputSchema>;
export type LessonQuestionContextSummary = z.infer<typeof lessonQuestionContextSummarySchema>;
export type LessonQuestionResource = z.infer<typeof lessonQuestionResourceSchema>;
export type LessonQuestionThreadResource = z.infer<typeof lessonQuestionThreadResourceSchema>;

import { z } from "zod";
import { lessonStepAnswerSchema } from "../lesson-player/contract";

export const MAX_LESSON_QUESTION_LENGTH = 2000;
export const MAX_LESSON_QUESTION_THREAD_TURNS = 50;

const MAX_LESSON_QUESTION_STEP_NUMBER = 2_147_483_647;

const lessonQuestionThreadCursorSchema = z.uuid();

/** The things a learner can ask the tutor about beyond a lesson; each has one thread. */
const SCREEN_CONTEXT_KINDS = ["chapter", "plan", "mock"] as const;

export const getLessonQuestionThreadInputSchema = z
  .object({
    contextKind: z.enum(["lesson", "step", "answer", ...SCREEN_CONTEXT_KINDS]).optional(),
    cursor: lessonQuestionThreadCursorSchema.optional(),
    stepId: z.uuid().optional(),
  })
  .strict();

const lessonQuestionLessonContextInputSchema = z
  .object({ kind: z.literal("lesson"), stepIds: z.array(z.uuid()).optional() })
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
    /** Language exercises answer in today's shapes; Library screens also answer checks and text. */
    answer: lessonStepAnswerSchema,
    kind: z.literal("answer"),
    stepId: z.uuid(),
    stepNumber: lessonQuestionStepNumberSchema,
  })
  .strict();

/** A chapter, plan or mock is asked about as a whole: the server builds what it shows. */
const lessonQuestionScreenContextSchema = z.object({ kind: z.enum(SCREEN_CONTEXT_KINDS) }).strict();

export const lessonQuestionContextInputSchema = z.discriminatedUnion("kind", [
  lessonQuestionLessonContextInputSchema,
  lessonQuestionStepContextInputSchema,
  lessonQuestionAnswerContextInputSchema,
  lessonQuestionScreenContextSchema,
]);

export const createLessonQuestionInputSchema = z
  .object({
    context: lessonQuestionContextInputSchema,
    question: z.string().trim().min(1).max(MAX_LESSON_QUESTION_LENGTH),
    requestId: z.uuid(),
    /**
     * The learner sent one of the tutor's suggested questions as offered. A suggested question
     * about a lesson screen is answered once for everyone who asks it there.
     */
    suggested: z.literal(true).optional(),
  })
  .strict();

const lessonQuestionContextSummarySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("lesson") }).strict(),
  lessonQuestionScreenContextSchema,
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
/** A question about a lesson: all of it, one screen, or an answer given on a screen. */
export type LessonScopeContextInput = Extract<
  LessonQuestionContextInput,
  { kind: "answer" | "lesson" | "step" }
>;
export type LessonQuestionContextSummary = z.infer<typeof lessonQuestionContextSummarySchema>;
export type LessonQuestionScreenKind = (typeof SCREEN_CONTEXT_KINDS)[number];

/**
 * What a tutor thread is about: a Library lesson, a chapter, the plan of one of the learner's
 * goals (with the course it's built from), or one of their finished mocks (by its session block,
 * as the API addresses mocks everywhere). A learner has one thread per thing.
 */
export type TutorTarget =
  | { chapterId: string; kind: "chapter" }
  | { goalId: string; kind: "plan" }
  | { blockId: string; kind: "mock" }
  | { kind: "lesson"; lessonId: string };
export type LessonQuestionResource = z.infer<typeof lessonQuestionResourceSchema>;
export type LessonQuestionThreadResource = z.infer<typeof lessonQuestionThreadResourceSchema>;

const memoryFactSummarySchema = z.object({ id: z.uuid(), statement: z.string() }).nullable();

/**
 * What a Library lesson's tutor answer changed in the learner's memory, sent as the answer
 * stream's `data-memory` part after the text, for a "Memory updated" notice with undo.
 */
export const lessonQuestionMemoryChangesSchema = z.array(
  z.object({
    action: z.enum(["added", "removed", "replaced"]),
    fact: memoryFactSummarySchema,
    previous: memoryFactSummarySchema,
  }),
);

export type LessonQuestionMemoryChange = z.infer<typeof lessonQuestionMemoryChangesSchema>[number];

/** The answer stream's part that carries memory changes. */
export const LESSON_QUESTION_MEMORY_PART = "data-memory";

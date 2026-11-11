import { type GoalTutorAppTool } from "@zoonk/ai/tasks/tutor/goal-tutor-tools";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { lessonStepAnswerSchema } from "../lesson-player/contract";
import { planChangeSchema } from "../plans/plan-change-contract";
import { missionMomentSchema } from "../sessions/completion-contract";
import { tutorToolOfferSchema } from "./tutor-tool-offer-contract";

export type {
  GoalTutorLinks,
  GoalTutorPage,
  TutorLink,
} from "@zoonk/ai/tasks/tutor/goal-tutor-pages";

export const MAX_LESSON_QUESTION_LENGTH = 2000;
export const MAX_LESSON_QUESTION_THREAD_TURNS = 50;

const MAX_LESSON_QUESTION_STEP_NUMBER = 2_147_483_647;

const lessonQuestionThreadCursorSchema = uuidSchema();

const SCREEN_CONTEXT_KINDS = ["chapter", "plan", "mock", "subject"] as const;

/** Send id as suggestion; the server stores the question in the same localized words. */
export const lessonTutorSuggestionSchema = z
  .object({ id: z.enum(["simpler", "deeper", "example"]), label: z.string() })
  .strict()
  .meta({ id: "LessonTutorSuggestion" });

export const getLessonQuestionThreadInputSchema = z
  .object({
    contextKind: z.enum(["lesson", "step", "answer", "item", ...SCREEN_CONTEXT_KINDS]).optional(),
    cursor: lessonQuestionThreadCursorSchema.optional(),
    mistakeId: uuidSchema().optional(),
    stepId: uuidSchema().optional(),
  })
  .strict();

const lessonQuestionLessonContextInputSchema = z
  .object({ kind: z.literal("lesson"), stepIds: z.array(uuidSchema()).optional() })
  .strict();

/** Client ordinals are presentation-only because screens can shuffle; content is always resolved by step id. */
const lessonQuestionStepNumberSchema = z.number().int().min(1).max(MAX_LESSON_QUESTION_STEP_NUMBER);

const lessonQuestionStepContextInputSchema = z
  .object({
    kind: z.literal("step"),
    mistakeId: uuidSchema().optional(),
    stepId: uuidSchema(),
    stepNumber: lessonQuestionStepNumberSchema,
  })
  .strict();

const lessonQuestionAnswerContextInputSchema = z
  .object({
    answer: lessonStepAnswerSchema,
    kind: z.literal("answer"),
    mistakeId: uuidSchema().optional(),
    stepId: uuidSchema(),
    stepNumber: lessonQuestionStepNumberSchema,
  })
  .strict();

const lessonQuestionScreenContextSchema = z.object({ kind: z.enum(SCREEN_CONTEXT_KINDS) }).strict();

/** answered gates all answer/solution context; math numbers come from the named block. */
const lessonQuestionItemContextSchema = z
  .object({
    answered: z.boolean(),
    blockId: uuidSchema()
      .optional()
      .meta({ description: "The session block it's asked in; absent in mistakes practice" }),
    kind: z.literal("item"),
    mistakeId: uuidSchema().optional(),
  })
  .strict();

export const lessonQuestionContextInputSchema = z.discriminatedUnion("kind", [
  lessonQuestionLessonContextInputSchema,
  lessonQuestionStepContextInputSchema,
  lessonQuestionAnswerContextInputSchema,
  lessonQuestionScreenContextSchema,
  lessonQuestionItemContextSchema,
]);

export const createLessonQuestionInputSchema = z
  .object({
    context: lessonQuestionContextInputSchema,
    question: z.string().trim().min(1).max(MAX_LESSON_QUESTION_LENGTH),
    requestId: uuidSchema(),
    /** The server words suggestions and may share their answers; typed learner questions remain personal. */
    suggestion: z.enum(["simpler", "deeper", "example"]).optional(),
  })
  .strict();

export type TutorTool = GoalTutorAppTool;

const lessonQuestionContextSummarySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("lesson") }).strict(),
  z
    .object({
      answered: z.boolean().meta({ description: "Asked about their checked answer" }),
      kind: z.literal("item"),
    })
    .strict(),
  lessonQuestionScreenContextSchema,
  z
    .object({
      kind: z.literal("step"),
      stepId: uuidSchema().nullable(),
      stepNumber: lessonQuestionStepNumberSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("answer"),
      stepId: uuidSchema().nullable(),
      stepNumber: lessonQuestionStepNumberSchema,
    })
    .strict(),
]);

export const lessonQuestionResourceSchema = z
  .object({
    answer: z.string().nullable(),
    context: lessonQuestionContextSummarySchema,
    createdAt: z.iso.datetime(),
    id: uuidSchema(),
    /** Proposals require a learner tap before applying. */
    planChange: planChangeSchema.nullable(),
    question: z.string(),
    status: z.enum(["pending", "running", "completed", "failed"]),
    toolOffer: tutorToolOfferSchema.nullable(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const lessonQuestionThreadResourceSchema = z
  .object({
    hasMore: z.boolean(),
    id: uuidSchema(),
    lessonId: uuidSchema().nullable(),
    nextCursor: lessonQuestionThreadCursorSchema.nullable(),
    questions: z.array(lessonQuestionResourceSchema),
  })
  .strict();

export const lessonQuestionThreadResponseSchema = lessonQuestionThreadResourceSchema.nullable();

export type CreateLessonQuestionInput = z.infer<typeof createLessonQuestionInputSchema>;
export type GetLessonQuestionThreadInput = z.infer<typeof getLessonQuestionThreadInputSchema>;
export type LessonQuestionContextInput = z.infer<typeof lessonQuestionContextInputSchema>;
export type LessonScopeContextInput = Extract<
  LessonQuestionContextInput,
  { kind: "answer" | "lesson" | "step" }
>;
export type LessonQuestionContextSummary = z.infer<typeof lessonQuestionContextSummarySchema>;
export type LessonQuestionItemContext = z.infer<typeof lessonQuestionItemContextSchema>;
export type LessonQuestionScreenKind = (typeof SCREEN_CONTEXT_KINDS)[number];
export type LessonScreenSuggestion = z.infer<typeof lessonTutorSuggestionSchema>["id"];
export type LessonTutorSuggestion = z.infer<typeof lessonTutorSuggestionSchema>;

/** One thread per learner and target; mocks are addressed by their session block. */
export type TutorTarget =
  | { chapterId: string; kind: "chapter" }
  | { goalId: string; kind: "plan" }
  | { goalId: string; kind: "subject"; subjectKey: string }
  | { itemId: string; kind: "item" }
  | { blockId: string; kind: "mock" }
  | { kind: "lesson"; lessonId: string };
export const createdLessonQuestionSchema = lessonQuestionResourceSchema.extend({
  missionMoment: missionMomentSchema.nullable(),
});

export type LessonQuestionResource = z.infer<typeof lessonQuestionResourceSchema>;
export type CreatedLessonQuestion = z.infer<typeof createdLessonQuestionSchema>;
export type LessonQuestionThreadResource = z.infer<typeof lessonQuestionThreadResourceSchema>;

const memoryFactSummarySchema = z.object({ id: uuidSchema(), statement: z.string() }).nullable();

/** Sent after answer text as data-memory; consumers may offer undo. */
export const lessonQuestionMemoryChangesSchema = z.array(
  z.object({
    action: z.enum(["added", "removed", "replaced"]),
    fact: memoryFactSummarySchema,
    previous: memoryFactSummarySchema,
  }),
);

export type LessonQuestionMemoryChange = z.infer<typeof lessonQuestionMemoryChangesSchema>[number];

export const LESSON_QUESTION_MEMORY_PART = "data-memory";

export const LESSON_QUESTION_PLAN_CHANGE_PART = "data-plan-change";

export const LESSON_QUESTION_TOOL_OFFER_PART = "data-tool-offer";

/** Replaced proposal ids let clients invalidate earlier cards without rereading the thread. */
export const LESSON_QUESTION_REPLACED_CHANGES_PART = "data-plan-changes-replaced";

export const replacedPlanChangesSchema = z.object({ ids: z.array(uuidSchema()) });

/** Only saved answer text has validated live links; streamed text must remain unlinked until this replacement arrives. */
export const LESSON_QUESTION_SAVED_ANSWER_PART = "data-saved-answer";

export const savedAnswerSchema = z.object({ answer: z.string() });

import { type GoalTutorAppTool } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-tools";
import { z } from "zod";
import { lessonStepAnswerSchema } from "../lesson-player/contract";
import { planChangeSchema } from "../plans/plan-change-contract";
import { WRITTEN_CADENCES } from "../plans/planner/plan-state";
import { missionMomentSchema } from "../sessions/completion-contract";
import { practiceCallSchema } from "../view-models/language/language-view-contract";

export type {
  GoalTutorLinks,
  GoalTutorPage,
  TutorLink,
} from "@zoonk/ai/tasks/v2/tutor/goal-tutor-pages";

export const MAX_LESSON_QUESTION_LENGTH = 2000;
export const MAX_LESSON_QUESTION_THREAD_TURNS = 50;

const MAX_LESSON_QUESTION_STEP_NUMBER = 2_147_483_647;

const lessonQuestionThreadCursorSchema = z.uuid();

const SCREEN_CONTEXT_KINDS = ["chapter", "plan", "mock", "subject"] as const;

const LESSON_SCREEN_SUGGESTIONS = ["simpler", "deeper", "example"] as const;

/** Send id as suggestion; the server stores the question in the same localized words. */
export const lessonTutorSuggestionSchema = z
  .object({ id: z.enum(LESSON_SCREEN_SUGGESTIONS), label: z.string() })
  .strict()
  .meta({ id: "LessonTutorSuggestion" });

export const getLessonQuestionThreadInputSchema = z
  .object({
    contextKind: z.enum(["lesson", "step", "answer", "item", ...SCREEN_CONTEXT_KINDS]).optional(),
    cursor: lessonQuestionThreadCursorSchema.optional(),
    stepId: z.uuid().optional(),
  })
  .strict();

const lessonQuestionLessonContextInputSchema = z
  .object({ kind: z.literal("lesson"), stepIds: z.array(z.uuid()).optional() })
  .strict();

/** Client ordinals are presentation-only because screens can shuffle; content is always resolved by step id. */
const lessonQuestionStepNumberSchema = z.number().int().min(1).max(MAX_LESSON_QUESTION_STEP_NUMBER);

const lessonQuestionStepContextInputSchema = z
  .object({ kind: z.literal("step"), stepId: z.uuid(), stepNumber: lessonQuestionStepNumberSchema })
  .strict();

const lessonQuestionAnswerContextInputSchema = z
  .object({
    answer: lessonStepAnswerSchema,
    kind: z.literal("answer"),
    stepId: z.uuid(),
    stepNumber: lessonQuestionStepNumberSchema,
  })
  .strict();

const lessonQuestionScreenContextSchema = z.object({ kind: z.enum(SCREEN_CONTEXT_KINDS) }).strict();

/** answered gates all answer/solution context; math numbers come from the named block. */
const lessonQuestionItemContextSchema = z
  .object({
    answered: z.boolean(),
    blockId: z
      .uuid()
      .optional()
      .meta({ description: "The session block it's asked in; absent in mistakes practice" }),
    kind: z.literal("item"),
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
    requestId: z.uuid(),
    /** The server words suggestions and may share their answers; typed learner questions remain personal. */
    suggestion: z.enum(LESSON_SCREEN_SUGGESTIONS).optional(),
  })
  .strict();

export type TutorTool = GoalTutorAppTool;

const tutorOfferAccessSchema = z
  .enum(["open", "plusRequired"])
  .meta({
    description: "plusRequired: shown locked, with what Plus unlocks, instead of its button",
  });

const tutorOfferCourseSchema = z
  .object({
    brandSlug: z.string(),
    description: z.string().nullable(),
    id: z.uuid(),
    imageUrl: z.string().nullable(),
    slug: z.string(),
    title: z.string(),
  })
  .strict();

function placeOfferSchema<Kind extends string>({
  description,
  kind,
}: {
  description: string;
  kind: Kind;
}) {
  return z.object({ kind: z.literal(kind).meta({ description }) }).strict();
}

export const tutorToolOfferSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        access: tutorOfferAccessSchema,
        course: tutorOfferCourseSchema
          .nullable()
          .meta({ description: "A catalog course that teaches the subject, when one matches" }),
        goal: z
          .string()
          .meta({ description: "What the learner wants, in their words, filled in to start it" }),
        kind: z.literal("startGoal"),
      })
      .strict(),
    z
      .object({
        chapterId: z
          .uuid()
          .meta({
            description: "The chapter whose test-out to start (`POST …/test-out/generations`)",
          }),
        chapterTitle: z.string(),
        goalId: z.uuid(),
        kind: z.literal("chapterTest"),
        lessonsLeft: z
          .int()
          .min(1)
          .meta({ description: "Lessons of the plan passing the test can skip" }),
      })
      .strict(),
    z
      .object({
        goalId: z.uuid(),
        kind: z
          .literal("chooseFocus")
          .meta({ description: "Choosing which subjects get the plan's depth, or the focus test" }),
      })
      .strict(),
    z
      .object({
        call: practiceCallSchema,
        chapterId: z
          .uuid()
          .meta({ description: "The unit whose practice call to start (`kind: practice`)" }),
        goalId: z.uuid(),
        kind: z.literal("conversationCall"),
        unitTitle: z.string(),
      })
      .strict(),
    z
      .object({
        access: tutorOfferAccessSchema,
        goalId: z.uuid(),
        kind: z
          .literal("mockExam")
          .meta({
            description:
              "Choosing a mock exam to take now (`GET /v1/goals/{goalId}/mocks`), or continuing the one started",
          }),
        subjects: z
          .array(z.string())
          .meta({
            description:
              "The subjects a mock can also be on alone, besides the full exam, the biggest first; empty when none can",
          }),
      })
      .strict(),
    z
      .object({
        access: tutorOfferAccessSchema,
        cadence: z.enum(WRITTEN_CADENCES).meta({ description: "When the plan practices it" }),
        goalId: z.uuid(),
        kind: z
          .literal("essay")
          .meta({ description: "The exam's written test, as its subject's page in the plan" }),
        subject: z
          .string()
          .meta({ description: "The written test's subject, as the syllabus names it" }),
        subjectKey: z
          .string()
          .meta({ description: "The subject's key in the goal's syllabus (`GET …/syllabus`)" }),
      })
      .strict(),
    z
      .object({
        goalId: z.uuid(),
        kind: z.literal("mistakes").meta({ description: "The goal's mistakes notebook" }),
        open: z.int().min(1).meta({ description: "Mistakes waiting to be fixed" }),
      })
      .strict(),
    z
      .object({
        count: z.int().min(1).meta({ description: "Words due to be said again" }),
        goalId: z.uuid(),
        kind: z
          .literal("pronunciation")
          .meta({ description: "Saying again the words the learner mispronounced" }),
        words: z.array(z.string()).meta({ description: "The first few of them" }),
      })
      .strict(),
    placeOfferSchema({ description: "The learner's statistics", kind: "stats" }),
    placeOfferSchema({ description: "The learner's week in review", kind: "logbook" }),
    placeOfferSchema({ description: "What the app remembers about the learner", kind: "memory" }),
    z
      .object({
        kind: z.literal("plus").meta({ description: "The Plus plan's page" }),
        subscribed: z.boolean().meta({ description: "The learner already has Plus" }),
      })
      .strict(),
  ])
  .meta({ id: "TutorToolOffer" });

export type TutorToolOffer = z.infer<typeof tutorToolOfferSchema>;

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
export type LessonScopeContextInput = Extract<
  LessonQuestionContextInput,
  { kind: "answer" | "lesson" | "step" }
>;
export type LessonQuestionContextSummary = z.infer<typeof lessonQuestionContextSummarySchema>;
export type LessonQuestionItemContext = z.infer<typeof lessonQuestionItemContextSchema>;
export type LessonQuestionScreenKind = (typeof SCREEN_CONTEXT_KINDS)[number];
export type LessonScreenSuggestion = (typeof LESSON_SCREEN_SUGGESTIONS)[number];
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

const memoryFactSummarySchema = z.object({ id: z.uuid(), statement: z.string() }).nullable();

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

export const replacedPlanChangesSchema = z.object({ ids: z.array(z.uuid()) });

/** Only saved answer text has validated live links; streamed text must remain unlinked until this replacement arrives. */
export const LESSON_QUESTION_SAVED_ANSWER_PART = "data-saved-answer";

export const savedAnswerSchema = z.object({ answer: z.string() });

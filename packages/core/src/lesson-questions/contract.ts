import { type GoalTutorAppTool } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-tools";
import { z } from "zod";
import { lessonStepAnswerSchema } from "../lesson-player/contract";
import { planChangeSchema } from "../plans/plan-change-contract";
import { WRITTEN_CADENCES } from "../plans/planner/plan-state";
import { practiceCallSchema } from "../view-models/language/language-view-contract";

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

export type TutorTool = GoalTutorAppTool;

/**
 * Whether the learner's plan includes an offered feature. Features are never hidden: one their
 * plan doesn't include is offered too, shown locked with what Plus unlocks.
 */
const tutorOfferAccessSchema = z
  .enum(["open", "plusRequired"])
  .meta({
    description: "plusRequired: shown locked, with what Plus unlocks, instead of its button",
  });

/** A course of the catalog, as a new goal's card shows it. */
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

/** A feature with nothing to say beyond where it opens. */
function placeOfferSchema<Kind extends string>({
  description,
  kind,
}: {
  description: string;
  kind: Kind;
}) {
  return z.object({ kind: z.literal(kind).meta({ description }) }).strict();
}

/**
 * One of the app's own features the buddy offered in an answer, when it answers what the learner
 * wants (`GOAL_TUTOR_APP_TOOLS` lists them all): starting a new goal (with a matching catalog
 * course), a chapter's test ("Already know this?"), choosing where the plan's depth goes (with the
 * focus test), a mock exam, the exam's written test, the mistakes notebook, a practice call or
 * pronunciation in the language being learned, statistics, the week in review, memory, or Plus.
 */
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
    /**
     * In a goal's conversation with the buddy, the plan change the answer proposed: it waits for
     * the learner's tap and says how it was answered.
     */
    planChange: planChangeSchema.nullable(),
    question: z.string(),
    status: z.enum(["pending", "running", "completed", "failed"]),
    /** In a goal's conversation with the buddy, one of the app's tools the answer offered. */
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

/**
 * The answer stream's part that carries the plan change the buddy proposed, as soon as it's
 * saved, so the conversation shows it with its Apply and Not now.
 */
export const LESSON_QUESTION_PLAN_CHANGE_PART = "data-plan-change";

/** The answer stream's part that carries one of the app's tools the buddy offered. */
export const LESSON_QUESTION_TOOL_OFFER_PART = "data-tool-offer";

/**
 * The answer stream's part that lists the conversation's earlier proposals the new one replaced
 * (it changes the same thing), so their cards say so without reading the thread again.
 */
export const LESSON_QUESTION_REPLACED_CHANGES_PART = "data-plan-changes-replaced";

export const replacedPlanChangesSchema = z.object({ ids: z.array(z.uuid()) });

import {
  createLessonQuestionInputSchema,
  createdLessonQuestionSchema,
  getLessonQuestionThreadInputSchema,
  lessonQuestionContextInputSchema,
  lessonQuestionResourceSchema,
  lessonQuestionThreadResourceSchema,
} from "@zoonk/core/lesson-questions/contract";
import { z } from "zod";

const lessonQuestionContextInputOpenAPISchema = lessonQuestionContextInputSchema.meta({
  id: "LessonQuestionContextInput",
});

export const lessonQuestionThreadQuerySchema = getLessonQuestionThreadInputSchema
  .extend({
    contextKind: getLessonQuestionThreadInputSchema.shape.contextKind.meta({
      description: "Filter by context kind; use lesson for the completion conversation",
    }),
    cursor: getLessonQuestionThreadInputSchema.shape.cursor.meta({
      description: "Opaque cursor returned in nextCursor",
    }),
    stepId: getLessonQuestionThreadInputSchema.shape.stepId.meta({
      description:
        "Return questions and answer explanations for this step only; pagination uses the same filter",
    }),
  })
  .meta({ id: "LessonQuestionThreadQuery" });

export const createLessonQuestionRequestSchema = createLessonQuestionInputSchema
  .extend({
    context: lessonQuestionContextInputOpenAPISchema,
    requestId: createLessonQuestionInputSchema.shape.requestId.meta({
      description: "Client-generated idempotency key reused for exact request retries",
    }),
    suggestion: createLessonQuestionInputSchema.shape.suggestion.meta({
      description:
        "The tutor's suggestion the learner tapped: the `id` of one of the lesson's `tutorSuggestions` (`GET /v1/library/lessons/{lessonId}`). The question is stored in that suggestion's words, whatever `question` says, and a lesson screen's suggestion is answered once for everyone who taps it there; anything typed is answered as the learner's own question",
    }),
  })
  .meta({ id: "CreateLessonQuestionRequest" });

export const lessonQuestionResponseSchema = lessonQuestionResourceSchema.meta({
  id: "LessonQuestion",
});

export const createdLessonQuestionResponseSchema = createdLessonQuestionSchema.meta({
  id: "CreatedLessonQuestion",
});

export const lessonQuestionThreadResponseSchema = lessonQuestionThreadResourceSchema
  .extend({
    hasMore: lessonQuestionThreadResourceSchema.shape.hasMore.meta({
      description: "Whether an earlier page exists",
    }),
    nextCursor: lessonQuestionThreadResourceSchema.shape.nextCursor.meta({
      description: "Opaque cursor for the earlier page",
    }),
    questions: z.array(lessonQuestionResponseSchema),
  })
  .meta({ id: "LessonQuestionThread" })
  .nullable();

export const lessonQuestionAnswerStreamSchema = z
  .string()
  .meta({
    description:
      "AI SDK UI message stream. Each data field contains a UI message chunk and the stream ends with a [DONE] event.",
    examples: ['data: {"type":"text-delta","id":"answer","delta":"An orbit is..."}\n\n'],
  });

const earlierQuestionSchema = z
  .object({
    answer: z
      .string()
      .nullable()
      .meta({ description: "The answer the learner got, null when none was saved" }),
    askedAt: z.iso.datetime(),
    courseTitle: z
      .string()
      .nullable()
      .meta({ description: "The course the lesson was in, as the learner saw it" }),
    id: z.uuid(),
    lessonTitle: z
      .string()
      .nullable()
      .meta({ description: "The lesson the question was about, as the learner saw it" }),
    question: z.string(),
  })
  .meta({
    description:
      "A question the learner asked about a lesson from an earlier version of a course, which no longer exists: shown as read-only history, with no link",
    id: "EarlierQuestion",
  });

export const earlierQuestionsQuerySchema = z
  .object({
    cursor: z.uuid().optional().meta({ description: "Opaque cursor returned in nextCursor" }),
  })
  .meta({ id: "EarlierQuestionsQuery" });

export const earlierQuestionsResponseSchema = z
  .object({
    nextCursor: z
      .uuid()
      .nullable()
      .meta({ description: "Reads the page of older questions; null on the last page" }),
    questions: z.array(earlierQuestionSchema),
  })
  .meta({ id: "EarlierQuestions" });

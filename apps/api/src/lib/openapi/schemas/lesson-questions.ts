import {
  createLessonQuestionInputSchema,
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
    cursor: getLessonQuestionThreadInputSchema.shape.cursor.meta({
      description: "Opaque cursor returned in nextCursor",
    }),
  })
  .meta({ id: "LessonQuestionThreadQuery" });

export const createLessonQuestionRequestSchema = createLessonQuestionInputSchema
  .extend({
    context: lessonQuestionContextInputOpenAPISchema,
    requestId: createLessonQuestionInputSchema.shape.requestId.meta({
      description: "Client-generated idempotency key reused for exact request retries",
    }),
  })
  .meta({ id: "CreateLessonQuestionRequest" });

export const lessonQuestionResponseSchema = lessonQuestionResourceSchema.meta({
  id: "LessonQuestion",
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

export const lessonQuestionAnswerResponseSchema = z.string();

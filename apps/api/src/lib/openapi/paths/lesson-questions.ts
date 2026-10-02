import { MAX_LESSON_QUESTION_THREAD_TURNS } from "@zoonk/core/lesson-questions/contract";
import { type z } from "zod";
import {
  createLessonQuestionRequestSchema,
  lessonQuestionAnswerStreamSchema,
  lessonQuestionResponseSchema,
  lessonQuestionThreadQuerySchema,
  lessonQuestionThreadResponseSchema,
} from "../schemas/lesson-questions";
import {
  chapterPathParamsSchema,
  goalPathParamsSchema,
  lessonPathParamsSchema,
  lessonQuestionPathParamsSchema,
  mockPathParamsSchema,
} from "../schemas/paths";
import {
  badRequestResponse,
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  paymentRequiredResponse,
  tooManyRequestsResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

/**
 * Every tutor thread has the same two routes: the learner's thread and a new question. Only what
 * the thread is about changes: a lesson, a chapter, a goal's plan or a finished mock.
 */
function tutorQuestionPaths<TPath extends z.ZodObject>({
  about,
  context,
  operation,
  pathSchema,
  tag,
}: {
  about: string;
  context: string;
  operation: string;
  pathSchema: TPath;
  tag: string;
}) {
  return {
    get: {
      description: `The current learner's private questions about ${about}.`,
      operationId: `get${operation}QuestionThread`,
      requestParams: { path: pathSchema, query: lessonQuestionThreadQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: lessonQuestionThreadResponseSchema } },
          description: `Up to ${MAX_LESSON_QUESTION_THREAD_TURNS} questions ordered chronologically within the page; omitting the cursor returns the newest page, or null before the first question`,
        },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: `Get the current learner's question thread about ${about}`,
      tags: [tag],
    },
    post: {
      description: `Asks the tutor about ${about}. ${context} Answer it with \`POST /v1/questions/{questionId}/answers\`.`,
      operationId: `create${operation}Question`,
      requestBody: {
        content: { "application/json": { schema: createLessonQuestionRequestSchema } },
        required: true,
      },
      requestParams: { path: pathSchema },
      responses: {
        "201": {
          content: { "application/json": { schema: lessonQuestionResponseSchema } },
          description: "Durable pending question",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
        "409": conflictResponse,
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: `Ask a question about ${about}`,
      tags: [tag],
    },
  };
}

export const lessonQuestionPaths = {
  "/chapters/{chapterId}/questions": tutorQuestionPaths({
    about: "a Library chapter",
    context:
      '`context` is `{ kind: "chapter" }`: the tutor sees the chapter\'s objectives and its lessons, with the ones the learner finished.',
    operation: "Chapter",
    pathSchema: chapterPathParamsSchema,
    tag: "Chapters",
  }),
  "/goals/{goalId}/plan/questions": tutorQuestionPaths({
    about: "the plan of one of the learner's goals",
    context:
      '`context` is `{ kind: "plan" }`: the tutor sees the plan\'s status, current phase, today\'s items with the reason each one is there, what comes next, and the outline of the course the plan is built from, so it can answer "Why am I studying this today?" and questions about the course. 422 while the plan is still being written.',
    operation: "Plan",
    pathSchema: goalPathParamsSchema,
    tag: "Plans",
  }),
  "/lessons/{lessonId}/questions": tutorQuestionPaths({
    about: "a Library lesson",
    context:
      "`context` is the whole lesson (`lesson`, with the step ids in the order the learner saw them), one screen (`step`) or an answer given on a screen (`answer`). A first question about a screen that someone already asked there is answered with the shared answer; send `suggested: true` when the learner sent one of the tutor's suggested questions as offered.",
    operation: "Lesson",
    pathSchema: lessonPathParamsSchema,
    tag: "Lessons",
  }),
  "/mocks/{blockId}/questions": tutorQuestionPaths({
    about: "one of the learner's mock exams",
    context:
      '`context` is `{ kind: "mock" }`: the tutor sees the mock\'s result, areas and the questions missed with their skills. Only finished mocks can be asked about; a running mock is 404.',
    operation: "Mock",
    pathSchema: mockPathParamsSchema,
    tag: "Exams",
  }),
  "/questions/{questionId}": {
    get: {
      operationId: "getLessonQuestion",
      requestParams: { path: lessonQuestionPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: lessonQuestionResponseSchema } },
          description: "Current learner-owned lesson question",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a lesson question",
      tags: ["Lessons"],
    },
  },
  "/questions/{questionId}/answers": {
    post: {
      description:
        "Claims a pending or failed question and returns one grounded answer as an AI SDK UI message stream, whatever the question is about (a lesson, chapter, plan or mock). `lessonId` in the question routes is a Library lesson. A first question about a lesson screen that someone already asked there streams the saved shared answer right away, without counting against the allowance or reading memory. Otherwise the answer counts against the learner's tutor allowance (403 asks a guest to sign up, 402 a free learner to upgrade, 429 to slow down or come back after the limit resets, with `SLOW_DOWN` or `USAGE_LIMIT_REACHED` and details), and reads the learner's memory. Its `finish` event comes once the answer is saved, so the answer is done and the learner can ask again; a `data-memory` part may follow with what the exchange changed in memory (each change's `action`, `fact` and `previous` with `id` and `statement`), to show and undo with `POST /v1/me/memory/change-reversals`.",
      operationId: "createLessonQuestionAnswer",
      requestParams: { path: lessonQuestionPathParamsSchema },
      responses: {
        "200": {
          content: { "text/event-stream": { schema: lessonQuestionAnswerStreamSchema } },
          description: "Lesson question answer streamed as AI SDK UI message events",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "402": paymentRequiredResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
        "409": conflictResponse,
        "429": {
          ...tooManyRequestsResponse,
          description:
            "The tutor allowance asks the learner to slow down or come back after the limit resets",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Generate a lesson question answer",
      tags: ["Lessons"],
    },
  },
};

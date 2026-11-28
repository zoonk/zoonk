import {
  mistakePracticeAnswerInputSchema,
  mistakePracticeFinishInputSchema,
  mistakePracticeInputSchema,
} from "@zoonk/core/mistakes/contract";
import {
  mistakeLessonSchema,
  mistakeListQuerySchema,
  mistakeListResponseSchema,
  mistakePracticeCompletionSchema,
  mistakePracticeFeedbackSchema,
  mistakePracticeResponseSchema,
} from "../schemas/mistakes";
import { mistakePathParamsSchema } from "../schemas/paths";
import {
  notFoundResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const mistakePaths = {
  "/me/mistake-practice": {
    get: {
      description:
        "Open, replayable mistakes, with misses from earlier learner-local days before today's. A notebook run has up to 50 original questions. A block scope keeps the remaining entries from that block's frozen list in order. A mock scope includes only a finished mock's mistakes.",
      operationId: "getCurrentUserMistakePractice",
      requestParams: { query: mistakePracticeInputSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mistakePracticeResponseSchema } },
          description: "The mistakes to practice",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Practice the current learner's mistakes",
      tags: ["Mistakes"],
    },
  },
  "/me/mistake-practice/completions": {
    post: {
      description:
        "Counts the first answer per mistake per local day toward Brain Power, Energy, and the day's totals. Retries add no rewards. A day block completes once every assigned mistake has been answered today or can no longer be asked. A block completion can have no answer IDs.",
      operationId: "createMistakePracticeCompletion",
      requestBody: {
        content: { "application/json": { schema: mistakePracticeFinishInputSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: mistakePracticeCompletionSchema } },
          description: "What the run earned",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Finish a mistake practice run",
      tags: ["Mistakes"],
    },
  },
  "/me/mistakes": {
    get: {
      description:
        "The mistakes notebook, newest first, filterable by goal, skill, cause and status, with counts for the filters and shared practice availability. Each entry preserves the original question, answers, context, picture, visual and shared passage or recording. Open mistakes with usable practice material are available as soon as they are saved.",
      operationId: "listCurrentUserMistakes",
      requestParams: { query: mistakeListQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mistakeListResponseSchema } },
          description: "A page of the mistakes notebook",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List the current learner's mistakes",
      tags: ["Mistakes"],
    },
  },
  "/me/mistakes/{mistakeId}/answers": {
    post: {
      description:
        "Grades the original question, and fixes the entry if answered right on a later learner-local day than its last miss. Each new submission gets a verdict. The same attempt ID replays its saved verdict. The first answer per mistake per local day counts toward progress.",
      operationId: "createMistakePracticeAnswer",
      requestBody: {
        content: { "application/json": { schema: mistakePracticeAnswerInputSchema } },
        required: true,
      },
      requestParams: { path: mistakePathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mistakePracticeFeedbackSchema } },
          description: "Feedback and where the entry stands",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Answer a mistake practice question",
      tags: ["Mistakes"],
    },
  },
  "/me/mistakes/{mistakeId}/lesson": {
    post: {
      description:
        "Opens the lesson where the current learner made this mistake, or a teaching lesson on the same skill. Prefers a lesson the learner finished, then one already written. If no accessible lesson exists, creates a lesson for the mistake. Another learner's mistake returns 404.",
      operationId: "openMistakeLesson",
      requestParams: { path: mistakePathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mistakeLessonSchema } },
          description: "The lesson to open",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Open a mistake's lesson",
      tags: ["Mistakes"],
    },
  },
};

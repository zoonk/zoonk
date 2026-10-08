import {
  answerExplanationInputSchema,
  answerExplanationSchema,
  lessonStepCheckInputSchema,
  lessonStepCheckResultSchema,
  libraryLessonCompletionInputSchema,
  libraryLessonCompletionSchema,
  libraryLessonRunSchema,
  libraryLessonStartInputSchema,
} from "@zoonk/core/lesson-player/contract";
import { challengeTeamSchema } from "@zoonk/core/library/challenges/team";
import { playableLibraryLessonResponseSchema } from "../schemas/library-lessons";
import { lessonPathParamsSchema } from "../schemas/paths";
import {
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  paymentRequiredResponse,
  smallAiHelpRefusalResponses,
  tooManyRequestsResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { stepPathParamsSchema } from "../schemas/steps";
import { AUTHENTICATED_SECURITY, OPTIONAL_AUTHENTICATION_SECURITY } from "../security";

export const libraryLessonPaths = {
  "/library/lessons/{lessonId}": {
    get: {
      description:
        'A Library lesson ready to play: its screens in order (hook, explanations, worked examples, checks, typed and spoken answers, activities, the summary and language exercises) with image URLs. The content is the same for everyone and includes the answers, so the app can give feedback at once. The screens load only with a session, a guest\'s included (POST /guests): without one, a written lesson returns its outline with `status: "sessionRequired"`, so lessons can\'t be scraped. While the content is being written, returns the outline with `status: "notGenerated"`. Reading screens is rate-limited per learner, and per network for guests: too many lessons in a short time is `SLOW_DOWN` (429, read it again after `Retry-After`). A private lesson is only visible to its owner.',
      operationId: "getLibraryLesson",
      requestParams: { path: lessonPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: playableLibraryLessonResponseSchema } },
          description: "The lesson, or its outline without a session or while it's written",
        },
        "400": validationErrorResponse,
        "404": notFoundResponse,
        "429": tooManyRequestsResponse,
      },
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Get a Library lesson to play",
      tags: ["Library lessons"],
    },
  },
  "/library/lessons/{lessonId}/challenge-team": {
    get: {
      description:
        "The colleagues in a challenge for the learner or guest: up to four names, kept with the plan the lesson is in (or the active goal's plan) so the same people show up across the course. The first time a plan's challenge is played, the team is picked from names in the lesson's language and stored. A challenge's `team` slots map to `members` in order, skipping the AI assistant, which goes by its role; replace `{{slotId}}` in the case's text with each slot's name.",
      operationId: "getChallengeTeam",
      requestParams: { path: lessonPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: challengeTeamSchema } },
          description: "The learner's team",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get the team for a lesson's challenge",
      tags: ["Library lessons"],
    },
  },
  "/library/lessons/{lessonId}/completions": {
    post: {
      description:
        'Finishes a run once every screen that takes an answer was answered in it, or once "I know this" got every check right. Adds Brain Power, Energy and the day\'s totals; a replay counts as a review. Repeating it returns the same result without counting twice.',
      operationId: "createLibraryLessonCompletion",
      requestBody: {
        content: { "application/json": { schema: libraryLessonCompletionInputSchema } },
        required: true,
      },
      requestParams: { path: lessonPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: libraryLessonCompletionSchema } },
          description: "What the run earned and when the lesson comes back",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Finish a Library lesson",
      tags: ["Library lessons"],
    },
  },
  "/library/lessons/{lessonId}/starts": {
    post: {
      description:
        "Starts a run of the lesson for the learner or guest. A new lesson counts toward the allowance once; restarting it is free, and a second start within half an hour resumes the same run with its `answers`, so the app opens the lesson where the learner left off. A refused start is `SLOW_DOWN` (429, try again after `Retry-After`) or `USAGE_LIMIT_REACHED` with `details.limit`: 403 asks a guest to sign up, 402 a free learner to upgrade, 429 Plus to come back later.",
      operationId: "createLibraryLessonStart",
      requestBody: {
        content: { "application/json": { schema: libraryLessonStartInputSchema } },
        required: true,
      },
      requestParams: { path: lessonPathParamsSchema },
      responses: {
        "201": {
          content: { "application/json": { schema: libraryLessonRunSchema } },
          description: "The run to answer and finish",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "402": {
          ...paymentRequiredResponse,
          description: "The free plan's lessons are used up; Plus has more",
        },
        "403": {
          ...forbiddenResponse,
          description: "A guest used their lessons; signing up keeps going",
        },
        "404": notFoundResponse,
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Start a Library lesson",
      tags: ["Library lessons"],
    },
  },
  "/steps/{stepId}/answer-explanations": {
    post: {
      description:
        'Explains why a typed answer to a lesson screen is wrong ("Explain answer"). The explanation is stored by screen and answer, so the next learner who gives the same answer gets it at once.',
      operationId: "createStepAnswerExplanation",
      requestBody: {
        content: { "application/json": { schema: answerExplanationInputSchema } },
        required: true,
      },
      requestParams: { path: stepPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: answerExplanationSchema } },
          description: "The explanation of that answer",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "422": unprocessableEntityResponse,
        ...smallAiHelpRefusalResponses,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Explain a typed answer",
      tags: ["Library lessons"],
    },
  },
  "/steps/{stepId}/checks": {
    post: {
      description:
        "Grades one answer to a lesson screen on the server and records it: the attempt, the review of its skill and, when wrong, an entry in the mistakes notebook. Checks, activities and language exercises are graded by the same code the app runs; typed answers (and the typed fallback of a spoken answer) by the grader. The answer counts toward an open run of the screen's lesson; a screen answered more often than a run allows is graded by code and not recorded. `LESSON_RUN_ENDED` (409) means the run finished.",
      operationId: "createStepCheck",
      requestBody: {
        content: { "application/json": { schema: lessonStepCheckInputSchema } },
        required: true,
      },
      requestParams: { path: stepPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: lessonStepCheckResultSchema } },
          description: "The verdict, the why and when the idea comes back",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "409": { ...conflictResponse, description: "The run already finished" },
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Check an answer to a lesson screen",
      tags: ["Library lessons"],
    },
  },
};

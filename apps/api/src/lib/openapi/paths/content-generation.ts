import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/contract";
import { generationWaitInputSchema } from "@zoonk/core/lookahead/contract";
import { z } from "zod";
import {
  goalGenerationQuerySchema,
  goalGenerationSchema,
  lessonGenerationSchema,
  lessonReadinessSchema,
  sessionPreparationSchema,
} from "../schemas/content-generation";
import {
  goalPathParamsSchema,
  lessonPathParamsSchema,
  studySessionPathParamsSchema,
} from "../schemas/paths";
import {
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  paymentRequiredResponse,
  tooManyRequestsResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

const TAG = "Content generation";

const location = z.object({
  Location: z
    .string()
    .meta({ description: "The run's status URL: GET /generations/{generationId}" }),
});

export const contentGenerationPaths = {
  "/goals/{goalId}/generations": {
    post: {
      description:
        "Starts a goal's curriculum (skill graph, plan and course outlines) or, for an explain question, its quick explanation again, such as after a start failed. A run already going is joined, and only what is missing is written. POST /goals starts it the first time. Stream GET /generations/{generationId}/events for live steps: a curriculum reports `understandGoal`, `readExamNotice` (only while research reads a class test's own material before its skill graph), `readNotice` (only while research reads a stored exam notice again with newer reading instructions before the skill graph), `buildSkillGraph`, `saveSkills`, `preparePlacement` (placement's questions start being written, by a run of their own that this stream doesn't follow: GET /goals/{goalId}/placement asks each once it's written), `createPlan`, `outlineCourses`, `prepareFirstLessons`, then `goalReady`, or `workflowError` when the plan couldn't be built; an explanation `classifyQuestion`, `findExplanation`, `writeExplanation` (completed once the explanation can be read), then `explanationReady` once its course to go further is linked. A run that finds another run already writing the goal reports `joinRunningGoal` or `joinRunningExplanation` with that run's id as `entityId`: follow that run's events instead. Starting a goal whose plan is already built again with a newer `researchId` reconciles the plan with that research, which counts as small AI help: a refusal is `SLOW_DOWN` or `USAGE_LIMIT_REACHED` (403 asks a guest to sign up, 402 a free learner to upgrade or come back, 429 Plus to slow down).",
      operationId: "createGoalGeneration",
      requestParams: { path: goalPathParamsSchema, query: goalGenerationQuerySchema },
      responses: {
        "202": {
          content: { "application/json": { schema: goalGenerationSchema } },
          description: "The run writing the goal's content",
          headers: location,
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "402": paymentRequiredResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Write a goal's curriculum or explanation",
      tags: [TAG],
    },
  },
  "/goals/{goalId}/lesson-preparations": {
    post: {
      description:
        "Gets a goal's first lessons written before its first study session exists: today's first lessons and the next study day's, as many as the learner's plan writes ahead. Placement's completion calls it itself; call it when placement ends another way, never on a screen view. For a guest only the plan's first lesson is written, counted as its start like opening it.",
      operationId: "createGoalLessonPreparation",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "202": {
          content: { "application/json": { schema: sessionPreparationSchema } },
          description: "Preparation started",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Prepare a goal's first lessons",
      tags: [TAG],
    },
  },
  "/library/lessons/{lessonId}/generations": {
    post: {
      description:
        "Gets a Library lesson written now. A written lesson answers `ready`. A lesson being written answers 202 with the run writing it, so a second request follows the same run from its stream's start instead of starting another. Otherwise a run starts. Asking to write a lesson counts as the lesson start it leads to (starting it once written counts nothing more), so a refusal is `SLOW_DOWN` or `USAGE_LIMIT_REACHED` like a lesson start.",
      operationId: "createLibraryLessonGeneration",
      requestParams: { path: lessonPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: lessonGenerationSchema } },
          description: "The lesson is ready",
        },
        "202": {
          content: { "application/json": { schema: lessonGenerationSchema } },
          description: "A run is writing the lesson",
          headers: location,
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "402": paymentRequiredResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
        "409": {
          ...conflictResponse,
          description: `Every draft the lesson gets was held back by its checks, so nothing writes it again and plans moved on without it. Error code: ${LESSON_PLAYER_ERROR_CODES.lessonSetAside}.`,
        },
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Write a Library lesson now",
      tags: [TAG],
    },
  },
  "/library/lessons/{lessonId}/readiness": {
    get: {
      description:
        "What a lesson page shows while a lesson isn't written yet: its status, the run writing it (stream GET /generations/{generationId}/events for live steps: `planLesson`, `writeLesson`, then `lessonReady`) and a ready alternative from the learner's plan, so there is never a dead end. Uncached.",
      operationId: "getLibraryLessonReadiness",
      requestParams: { path: lessonPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: lessonReadinessSchema } },
          description: "Where the lesson's content stands",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get whether a lesson is ready",
      tags: [TAG],
    },
  },
  "/me/generation-waits": {
    post: {
      description:
        "Records how long the learner waited for content to be written (the Generation Waited event), measured from the first waiting screen until the content was ready. Send it only after an actual wait.",
      operationId: "createGenerationWait",
      requestBody: {
        content: { "application/json": { schema: generationWaitInputSchema } },
        required: true,
      },
      responses: {
        "204": { description: "Recorded" },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Record a wait for content",
      tags: [TAG],
    },
  },
  "/study-sessions/{sessionId}/preparations": {
    post: {
      description:
        "Prepares content around one of the learner's study sessions: every lesson of this session and the next gets written in the background. Block starts, stops and the last block's completion call it themselves; call it when the learner moves a session along another way, never on a screen view. For a guest only the lesson they reach next is written, counted as its start like opening it.",
      operationId: "createStudySessionPreparation",
      requestParams: { path: studySessionPathParamsSchema },
      responses: {
        "202": {
          content: { "application/json": { schema: sessionPreparationSchema } },
          description: "Preparation started",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Prepare a study session's content",
      tags: [TAG],
    },
  },
};

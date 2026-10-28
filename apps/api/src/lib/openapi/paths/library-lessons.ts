import { libraryLessonCompletionInputSchema } from "@zoonk/core/lesson-player/completion-input-contract";
import {
  answerExplanationInputSchema,
  answerExplanationSchema,
  lessonStepCheckInputSchema,
  lessonStepCheckResultSchema,
  libraryLessonCompletionSchema,
  libraryLessonRunSchema,
  libraryLessonStartInputSchema,
} from "@zoonk/core/lesson-player/contract";
import { challengeTeamSchema } from "@zoonk/core/library/challenges/team";
import { lessonFitSchema, playableLibraryLessonResponseSchema } from "../schemas/library-lessons";
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
        'A Library lesson ready to play: its screens in order (hook, explanations, worked examples, checks, typed and spoken answers, activities, the summary and language exercises) with image URLs. The content is the same for everyone and includes the answers, so the app can give feedback at once. The screens load only with a session, a guest\'s included (POST /guests): without one, a written lesson returns its outline with `status: "sessionRequired"`, so lessons can\'t be scraped. While the content is being written, returns the outline with `status: "notGenerated"`. A private lesson is only visible to its owner.',
      operationId: "getLibraryLesson",
      requestParams: { path: lessonPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: playableLibraryLessonResponseSchema } },
          description: "The lesson, or its outline without a session or while it's written",
        },
        "400": validationErrorResponse,
        "404": notFoundResponse,
      },
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Get a Library lesson to play",
      tags: ["Library lessons"],
    },
  },
  "/library/lessons/{lessonId}/challenge-team": {
    get: {
      description:
        "The colleagues in a challenge for the learner or guest: up to four names, kept with the plan the lesson is in (or the active goal's plan) so the same people show up across the course. Without a team saved with the plan, it's picked from the plan with names in the lesson's language, the same every time; reading it never saves anything. A challenge's `team` slots map to `members` in order, skipping the AI assistant, which goes by its role; replace `{{slotId}}` in the case's text with each slot's name.",
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
        'Finishes a run once every screen that takes an answer was answered or explicitly skipped through `skippedWritingStepIds`, or once "I know this" got every check right. Only typed-answer screens can be explicitly skipped, in any lesson: these choices are recorded on the run without calling the grader, adding an answer verdict or changing future runs. Adds Brain Power, Energy and the day\'s totals; a replay counts as a review. Repeating it returns the same result without counting twice.',
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
  "/library/lessons/{lessonId}/fit": {
    get: {
      description:
        "Where a public lesson fits, for the end of a guest's lesson: \"Part of Quantum physics\", its chapter and the lesson's place in it, and the course's size. \"Build my plan\" starts that course from `course.startChapterId` (POST /courses/{courseId}/goals), or onboarding with the course's title when the lesson is in no public course. The same for everyone.",
      operationId: "getLibraryLessonFit",
      requestParams: { path: lessonPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: lessonFitSchema } },
          description: "Where the lesson fits",
        },
        "400": validationErrorResponse,
        "404": { ...notFoundResponse, description: "Not a public lesson in a chapter" },
      },
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Get where a Library lesson fits",
      tags: ["Library lessons"],
    },
  },
  "/library/lessons/{lessonId}/starts": {
    post: {
      description:
        "Starts a run of the lesson for the learner or guest. A new lesson counts toward the allowance once; restarting it is free, and a second start within half an hour resumes the same run with its `answers`, so the app opens the lesson where the learner left off. A refused start is `SLOW_DOWN` (429, try again after `Retry-After`) or `USAGE_LIMIT_REACHED` with `details.limit`: 403 asks a guest to sign up, 402 a free learner to upgrade, 429 Plus to come back later. A new lesson of a free exam plan past its first week (shown with `plusRequired` on its chapter) answers 402 `PLUS_REQUIRED`: Plus opens the rest of the plan, while lessons done or begun, lessons outside the plan, reviews and mistakes stay open.",
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
          description:
            "The free plan's lessons are used up (`USAGE_LIMIT_REACHED`; Plus has more), or a free exam plan past its first week holds this new lesson for Plus (`PLUS_REQUIRED`)",
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

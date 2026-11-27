import {
  placementAnswerInputSchema,
  placementCompletionInputSchema,
  placementQuerySchema,
} from "@zoonk/core/learner/placement/contract";
import {
  focusTestControlsInputSchema,
  focusTestSummarySchema,
  placementSittingInputSchema,
} from "@zoonk/core/learner/placement/focus-test-contract";
import { chapterTestOutInputSchema } from "@zoonk/core/learner/test-out/contract";
import { z } from "zod";
import {
  placementAnswerResponseSchema,
  placementCompletionResponseSchema,
  placementResponseSchema,
} from "../schemas/learner";
import {
  goalChapterPathParamsSchema,
  goalChapterTestOutResultPathParamsSchema,
  goalPathParamsSchema,
} from "../schemas/paths";
import {
  conflictResponse,
  guestRefusalResponse,
  notFoundResponse,
  paymentRequiredResponse,
  tooManyRequestsResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import {
  chapterTestOutRecordSchema,
  chapterTestOutResponseSchema,
  chapterTestOutResultSchema,
  nothingToSkipSchema,
  testOutGenerationSchema,
} from "../schemas/test-out";
import { AUTHENTICATED_SECURITY } from "../security";

const learnerErrors = {
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "404": notFoundResponse,
} as const;

export const placementPaths = {
  "/goals/{goalId}/chapters/{chapterId}/test-out": {
    get: {
      description:
        "Four unseen questions per sampled topic. Nothing is stored until the answers are submitted.",
      operationId: "getChapterTestOut",
      requestParams: { path: goalChapterPathParamsSchema },
      responses: {
        ...learnerErrors,
        "200": {
          content: {
            "application/json": {
              schema: z.union([chapterTestOutResponseSchema, nothingToSkipSchema]),
            },
          },
          description:
            "The chapter's test-out questions, or nothingToSkip when no lessons remain to skip",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a chapter test-out",
      tags: ["Learner"],
    },
    post: {
      description:
        "Grades the test-out. One correct quick choice and three correct low-guess tap answers confirm each topic. Only lessons teaching confirmed topics are skipped. The same test sent again (its `requestId`) returns what it recorded without grading, counting or celebrating it again.",
      operationId: "submitChapterTestOut",
      requestBody: {
        content: { "application/json": { schema: chapterTestOutInputSchema } },
        required: true,
      },
      requestParams: { path: goalChapterPathParamsSchema },
      responses: {
        ...learnerErrors,
        "200": {
          content: {
            "application/json": {
              schema: z.union([chapterTestOutResultSchema, nothingToSkipSchema]),
            },
          },
          description:
            "The test-out result, or nothingToSkip for a new submission with no lessons left to skip",
        },
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Submit a chapter test-out",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/chapters/{chapterId}/test-out/generations": {
    post: {
      description:
        "Gets a chapter's test-out ready when the learner asks for it (never on a screen view). `ready` when it has a question for every skill it samples. Otherwise a run writes missing tap questions for the sampled skills (shared with placement, reviews and practice) and answers 202; a second request joins that run. Each start counts as small AI help, so a refusal is `SLOW_DOWN` or `USAGE_LIMIT_REACHED`.",
      operationId: "createChapterTestOutGeneration",
      requestParams: { path: goalChapterPathParamsSchema },
      responses: {
        ...learnerErrors,
        "200": {
          content: {
            "application/json": { schema: z.union([testOutGenerationSchema, nothingToSkipSchema]) },
          },
          description:
            "The test-out has its questions, or nothingToSkip without starting generation",
        },
        "202": {
          content: { "application/json": { schema: testOutGenerationSchema } },
          description: "A run is writing the questions",
          headers: z.object({
            Location: z
              .string()
              .meta({ description: "The run's status URL: GET /generations/{generationId}" }),
          }),
        },
        "402": {
          ...paymentRequiredResponse,
          description: "The learner's AI help allowance is spent",
        },
        "403": guestRefusalResponse,
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Write a chapter test-out's questions",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/chapters/{chapterId}/test-out/results/{requestId}": {
    get: {
      description:
        "A test-out the learner sent, as it was recorded: its score, the lessons it skipped, and whether that skip can still be undone or was undone. Read it again after a reload or from a link instead of starting a new test. Nothing is written. 404 for a test never sent, another chapter's or another learner's.",
      operationId: "getChapterTestOutResult",
      requestParams: { path: goalChapterTestOutResultPathParamsSchema },
      responses: {
        ...learnerErrors,
        "200": {
          content: { "application/json": { schema: chapterTestOutRecordSchema } },
          description: "The test-out's recorded result",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a sent chapter test-out's result",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/placement": {
    get: {
      description:
        "Each phase's and each area's starting point, and what to do next (`status`). A course attempt follows fixed parts in plan order, with up to twelve questions in each part. An exam's Focus test asks questions in a separate sitting. Before the goal's skill map exists, `status` is `preparing` and `complete` is false.",
      operationId: "getGoalPlacement",
      requestParams: { path: goalPathParamsSchema, query: placementQuerySchema },
      responses: {
        ...learnerErrors,
        "200": {
          content: { "application/json": { schema: placementResponseSchema } },
          description: "The goal's placement",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a goal's placement",
      tags: ["Learner"],
    },
    patch: {
      description:
        "The learner's own switches on an exam goal's Focus test. `sessionQuestions`: `skippedToday` (\"Not today\", on a session question marked `placement`) and `paused` take today's unanswered test questions out of the day's session, until the learner's next day or until `on`; read the study block again afterwards, and a block left with no questions is gone from the day. `suggestion: dismissed` stops Today's suggestion of the test. 404 for a goal that isn't an exam.",
      operationId: "updateGoalFocusTest",
      requestBody: {
        content: { "application/json": { schema: focusTestControlsInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...learnerErrors,
        "200": {
          content: { "application/json": { schema: focusTestSummarySchema } },
          description: "The Focus test as the plan's row shows it",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Change a Focus test's session questions or suggestion",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/placement/answers": {
    post: {
      description:
        "Grades one placement answer, including \"I don't know yet\", and returns the updated placement with the next question. Placement answers never go to the mistakes notebook. An exam goal's Focus test gives no feedback on answers (`isCorrect` is still returned); an item the learner already answered in the test is not recorded again, so a retry is safe; once the returned `status` is `done`, the open sitting asks nothing more: close it with POST /goals/{goalId}/placement/completion.",
      operationId: "createPlacementAnswer",
      requestBody: {
        content: { "application/json": { schema: placementAnswerInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...learnerErrors,
        "200": {
          content: { "application/json": { schema: placementAnswerResponseSchema } },
          description: "The graded answer and the updated placement",
        },
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Answer a placement question",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/placement/completion": {
    post: {
      description:
        "Ends placement at any time. Skills placement is sure about become known and the plan skips what they cover. With fromScratch, nothing changes and every phase and area starts at its beginning. For an exam goal it closes the open Focus test sitting and returns the test with its result (`focusTest.checkpoint`); with no sitting and no answer it postpones the test (\"Skip\"): sessions ask no test questions until it starts; on a plan the learner has seen, a focus the answers suggest arrives as a proposed plan change (`source: focusTest`), never applied by itself; and `fromScratch` is refused with 422. Finishing before the goal's skill map exists places nothing: `complete` is false. The lesson the plan now opens with starts being written, counted as its start like opening it, so it's ready when the first session reaches it; for a learner with an account, Day 1's next lessons and the next study day's first ones are written too (see createGoalLessonPreparation).",
      operationId: "completeGoalPlacement",
      requestBody: {
        content: { "application/json": { schema: placementCompletionInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...learnerErrors,
        "200": {
          content: { "application/json": { schema: placementCompletionResponseSchema } },
          description: "Where each phase and area starts",
        },
        "409": conflictResponse,
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Finish a goal's placement",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/placement/sittings": {
    post: {
      description:
        "Starts or resumes a course placement attempt. The default is quick. A quick attempt can continue as the whole course without repeating its first part. For an exam goal, opens the sitting `focusTest.offer` describes, whose number of questions is fixed then (`sitting.questions`), and turns the test's session questions on. Asking again while a sitting is open returns that sitting. A learner whose plan wrote no test questions (they started from scratch) gets them written now, free: the state comes back `waitingForQuestions`; ask GET /goals/{goalId}/placement again soon. Every sitting is included in every plan, so it never answers a usage refusal. 404 when the goal has no test available.",
      operationId: "createPlacementSitting",
      requestBody: {
        content: { "application/json": { schema: placementSittingInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...learnerErrors,
        "200": {
          content: { "application/json": { schema: placementResponseSchema } },
          description: "The placement with its open attempt or sitting",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Start a placement test or Focus test sitting",
      tags: ["Learner"],
    },
  },
};

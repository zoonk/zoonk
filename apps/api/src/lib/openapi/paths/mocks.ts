import {
  anytimeMockInputSchema,
  mockPlanOfferInputSchema,
  mockQuestionsInputSchema,
  mockTimeZoneInputSchema,
} from "@zoonk/core/exams/mocks/contract";
import { z } from "zod";
import {
  mockEssayGradesResponseSchema,
  mockStepResponseSchema,
  mockViewResponseSchema,
} from "../schemas/mock-exam";
import {
  anytimeMockResponseSchema,
  mockOptionsResponseSchema,
  mockPlanOfferResultSchema,
  mockQuestionsGenerationSchema,
} from "../schemas/mocks";
import { goalPathParamsSchema, mockPathParamsSchema } from "../schemas/paths";
import {
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

const TAGS = ["Exams"];

const commonErrors = {
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "404": notFoundResponse,
};

/** Mock exams: the plan's weekly ones by their session block, and the ones taken any time. */
export const mockPaths = {
  "/goals/{goalId}/mocks": {
    get: {
      description:
        "The mocks the learner can take whenever they want for an exam goal, beside the plan's weekly ones: each exam day in full, half of the day in turn and each objective subject, with their questions, the exam's minutes for them and about how long learners really take (a class test's sized to it); whether the learner's plan includes them (every mock exam comes with Plus); the one running, to continue first; and the diagnostic mock onboarding offers instead of the quick placement, in its lengths.",
      operationId: "listMocks",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mockOptionsResponseSchema } },
          description: "The goal's mocks",
        },
        ...commonErrors,
        "422": { ...unprocessableEntityResponse, description: "The goal isn't an exam" },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List the mocks to take any time",
      tags: TAGS,
    },
    post: {
      description:
        "Starts one of the goal's mocks now (`shape` from the list), whenever and as often as the learner wants, or in onboarding a diagnostic mock as placement (`purpose: placement`, with a `length` from `placement.options`), its first section's clock running; then play it through /mocks/{id}. A running one is continued instead. It asks the shared bank's questions the learner never answered first. When the bank is short of them and the plan's fair use can have new ones written, it answers `needsQuestions`: POST /goals/{goalId}/mocks/generations, follow the run, and start again with `acceptFewer`. A mock still well short of its questions with nothing to write now answers `short` with what it can ask (`questions` of `examQuestions`, in `minutes`): start it with `acceptFewer` if the learner wants. Past fair use, or with `acceptFewer`, a mock of a subject or half a day asks questions the learner answered before for the rest, the missed ones first, then the ones answered longest ago (`reusedQuestions` on the mock); a full mock never does, so it asks fewer (`examQuestions` on the mock). A placement mock asks new questions only, grades only the questions answered, so stopping midway keeps them, and its answers set where the plan starts when placement finishes.",
      operationId: "startAnytimeMock",
      requestBody: {
        content: { "application/json": { schema: anytimeMockInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: anytimeMockResponseSchema } },
          description: "A mock was running already, or the bank needs questions first",
        },
        "201": {
          content: { "application/json": { schema: anytimeMockResponseSchema } },
          description: "The mock started",
          headers: z.object({
            Location: z.string().meta({ description: "The mock: GET /mocks/{id}" }),
          }),
        },
        ...commonErrors,
        "402": { ...paymentRequiredResponse, description: "Mock exams come with Plus" },
        "409": { ...conflictResponse, description: "The goal is paused" },
        "422": {
          ...unprocessableEntityResponse,
          description: "Not an exam, not one of its mocks, or too few questions for one",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Take a mock now",
      tags: TAGS,
    },
  },
  "/goals/{goalId}/mocks/generations": {
    post: {
      description:
        "Gets a mock's questions ready when the learner starts it (never on a screen view): `ready` when the shared bank holds them, `preparing` while the goal's skill map is still drawn, otherwise a run writes the missing ones in the exam's own format (shared with every later learner of the exam) and answers 202; a second request joins that run. Each run counts toward the plan's fair use for new mock questions (a diagnostic mock's, as small AI help); past it, nothing is written and it answers `ready`, for the mock to ask questions the learner answered before. A refusal is `SLOW_DOWN` or `USAGE_LIMIT_REACHED`.",
      operationId: "createMockQuestionsGeneration",
      requestBody: {
        content: { "application/json": { schema: mockQuestionsInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mockQuestionsGenerationSchema } },
          description:
            "The mock can start (the bank holds its questions, or fair use for new ones is used for now), or the skill map isn't ready yet",
        },
        "202": {
          content: { "application/json": { schema: mockQuestionsGenerationSchema } },
          description: "A run is writing the questions",
          headers: z.object({
            Location: z
              .string()
              .meta({ description: "The run's status URL: GET /generations/{generationId}" }),
          }),
        },
        ...commonErrors,
        "402": { ...paymentRequiredResponse, description: "Mock exams come with Plus" },
        "403": forbiddenResponse,
        "422": unprocessableEntityResponse,
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Write a mock's questions",
      tags: TAGS,
    },
  },
  "/mocks/{blockId}": {
    get: {
      description:
        "A mock exam in real conditions, by the id it opens by: the study session block that scheduled it (an exam goal's weekly Big Challenge), or its own id for one taken any time. Before it starts, its sections in the exam's order with questions, minutes, scoring and when the real exam starts; while it runs, the current section's questions (never the answers), its deadline and the saved drafts; once finished, what it showed (the exam's own score, estimated where it's an estimate, time per question against the pace, IRT coherence or Cebraspe calibration), mistakes by cause and the questions to review.",
      operationId: "getMock",
      requestParams: { path: mockPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mockViewResponseSchema } },
          description: "The mock",
        },
        ...commonErrors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a mock exam",
      tags: TAGS,
    },
  },
  "/mocks/{blockId}/essay-grades": {
    post: {
      description:
        "Grades a finished full mock's essays (its written part, `essays` with `pending` on GET /mocks/{blockId}) with the exam's official rubric, and records them as learning: call it right after the hand-in, while the objective result already shows. Each essay is graded once; a second request waits for the first one's grades. They count toward the day's essay grades: past them, the rest wait for another day (`ESSAY_LIMIT_REACHED`).",
      operationId: "gradeMockEssays",
      requestBody: {
        content: { "application/json": { schema: mockTimeZoneInputSchema } },
        required: true,
      },
      requestParams: { path: mockPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mockEssayGradesResponseSchema } },
          description: "Every written essay has its grade: GET /mocks/{blockId} shows them",
        },
        ...commonErrors,
        "409": { ...conflictResponse, description: "The mock isn't handed in yet" },
        "429": { ...tooManyRequestsResponse, description: "Today's essay grades are used up" },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Grade a mock's essays",
      tags: TAGS,
    },
  },
  "/mocks/{blockId}/finishes": {
    post: {
      description:
        "Ends the mock now, like leaving the exam early: unanswered questions count as blank (a placement mock leaves them out), and it's graded, recorded in the learner model and settled (in its session, for a scheduled one).",
      operationId: "finishMock",
      requestBody: {
        content: { "application/json": { schema: mockTimeZoneInputSchema } },
        required: true,
      },
      requestParams: { path: mockPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mockStepResponseSchema } },
          description: "Finished",
        },
        ...commonErrors,
        "409": { ...conflictResponse, description: "The mock isn't running" },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Finish a mock exam",
      tags: TAGS,
    },
  },
  "/mocks/{blockId}/plan-changes": {
    post: {
      description:
        "The learner's yes to what a finished mock offers (`adapt` on GET /mocks/{blockId}), never applied without it: `skip` tests out the plan's lessons on the topics the mock showed they know (every question on them right, at least two), as a change with an undo; `focus` gives the area that went worst more of the plan's time, as their own focus. `unchanged` when nothing moved, with why for a focus.",
      operationId: "adaptPlanFromMock",
      requestBody: {
        content: { "application/json": { schema: mockPlanOfferInputSchema } },
        required: true,
      },
      requestParams: { path: mockPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mockPlanOfferResultSchema } },
          description: "Applied, or why nothing moved",
        },
        ...commonErrors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Change the plan from a mock",
      tags: TAGS,
    },
  },
  "/mocks/{blockId}/starts": {
    post: {
      description:
        "Starts the mock when the learner takes it on (or resumes it): its session block starts, the sections are fixed and the first section's clock starts.",
      operationId: "startMock",
      requestBody: {
        content: { "application/json": { schema: mockTimeZoneInputSchema } },
        required: true,
      },
      requestParams: { path: mockPathParamsSchema },
      responses: {
        "204": { description: "Running" },
        ...commonErrors,
        "403": { ...forbiddenResponse, description: "Today's time limit is reached" },
        "409": { ...conflictResponse, description: "The mock or its block already finished" },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Start a mock exam",
      tags: TAGS,
    },
  },
};

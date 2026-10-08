import {
  anytimeMockInputSchema,
  mockAnswerInputSchema,
  mockPlanOfferInputSchema,
  mockQuestionsInputSchema,
  mockTimeZoneInputSchema,
} from "@zoonk/core/exams/mocks/contract";
import { z } from "zod";
import {
  anytimeMockResponseSchema,
  mockOptionsResponseSchema,
  mockPlanOfferResultSchema,
  mockQuestionsGenerationSchema,
  mockStepResponseSchema,
  mockViewResponseSchema,
} from "../schemas/mocks";
import {
  goalPathParamsSchema,
  mockPathParamsSchema,
  mockSectionPathParamsSchema,
} from "../schemas/paths";
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
        "Starts one of the goal's mocks now (`shape` from the list), or in onboarding a diagnostic mock as placement (`purpose: placement`, with a `length` from `placement.options`), from the shared bank's questions the learner never answered, its first section's clock running; then play it through /mocks/{id}. A running one is continued instead. When the bank is short of the mock's questions it answers `needsQuestions`: POST /goals/{goalId}/mocks/generations, follow the run, and start again with `acceptFewer`. A placement mock grades only the questions answered, so stopping midway keeps them, and its answers set where the plan starts when placement finishes.",
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
        "403": { ...forbiddenResponse, description: "Today's time limit is reached" },
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
        "Gets a mock's questions ready when the learner starts it (never on a screen view): `ready` when the shared bank holds them, `preparing` while the goal's skill map is still drawn, otherwise a run writes the missing ones in the exam's own format (shared with every later learner of the exam) and answers 202; a second request joins that run. Each start counts as small AI help, so a refusal is `SLOW_DOWN` or `USAGE_LIMIT_REACHED`.",
      operationId: "createMockQuestionsGeneration",
      requestBody: {
        content: { "application/json": { schema: mockQuestionsInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mockQuestionsGenerationSchema } },
          description: "The bank holds the mock's questions, or the skill map isn't ready yet",
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
  "/mocks/{blockId}/answers": {
    put: {
      description:
        "Saves a draft answer in the running section, like marking an answer sheet: a pick or null for blank, whether it's flagged to come back to (which also marks it unsure, for calibration) and the time spent. Nothing is graded until the mock ends. A section whose time ran out takes no more answers.",
      operationId: "saveMockAnswer",
      requestBody: {
        content: { "application/json": { schema: mockAnswerInputSchema } },
        required: true,
      },
      requestParams: { path: mockPathParamsSchema },
      responses: {
        "204": { description: "Saved" },
        ...commonErrors,
        "409": { ...conflictResponse, description: "The mock isn't running or the time ran out" },
        "422": { ...unprocessableEntityResponse, description: "Not in the running section" },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Save a mock answer",
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
  "/mocks/{blockId}/sections/{section}/submissions": {
    post: {
      description:
        "Hands in the running section, by the learner or when its time runs out: the next section's clock starts (an adaptive exam's next module is picked from how the last one went), and handing in the last section ends and grades the mock.",
      operationId: "submitMockSection",
      requestBody: {
        content: { "application/json": { schema: mockTimeZoneInputSchema } },
        required: true,
      },
      requestParams: { path: mockSectionPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mockStepResponseSchema } },
          description: "The next section started, or the mock finished",
        },
        ...commonErrors,
        "409": { ...conflictResponse, description: "Not the running section" },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Hand in a mock section",
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

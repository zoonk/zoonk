import {
  anytimeMockInputSchema,
  mockPlanOfferInputSchema,
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
  preparingMockResponseSchema,
} from "../schemas/mocks";
import { goalPathParamsSchema, mockPathParamsSchema } from "../schemas/paths";
import {
  conflictResponse,
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

export const mockPaths = {
  "/goals/{goalId}/mocks": {
    get: {
      description:
        "The mocks the learner can take whenever they want for an exam goal, beside the plan's weekly ones: each exam day in full, half of each exam day and each objective subject, with their questions, the exam's minutes for them and about how long learners really take (a class test's sized to it); whether the learner's plan includes them (every mock exam comes with Plus); the one running, to continue first; the last requested option and whether it is ready to start; and the diagnostic mock offered during onboarding.",
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
        "Starts the full requested option or resumes the running sitting. While a part needs questions, the request is saved and the clock stays stopped. The first ten on-demand sittings in a rolling 30 days use unseen questions. Later sittings may include questions last seen in earlier mocks, oldest first.",
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
          description: "The goal is not an exam or does not offer the requested option",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Take a mock now",
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
          description: "Finished, or expired (its time ran out while the learner was away)",
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
        "Starts the mock when the learner takes it on (or resumes it): its session block starts, the sections are fixed and the first section's clock starts. The plan's mock whose time ran out while the learner was away starts again in a new sitting; one taken any time stays expired (`MOCK_EXPIRED`): start a new one from the goal's mocks.",
      operationId: "startMock",
      requestBody: {
        content: { "application/json": { schema: mockTimeZoneInputSchema } },
        required: true,
      },
      requestParams: { path: mockPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: preparingMockResponseSchema } },
          description: "The scheduled mock needs questions before it can start",
        },
        "204": { description: "Running" },
        "402": { ...paymentRequiredResponse, description: "Mock exams come with Plus" },
        ...commonErrors,
        "409": {
          ...conflictResponse,
          description: "The mock or its block already finished, or the mock expired",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Start a mock exam",
      tags: TAGS,
    },
  },
};

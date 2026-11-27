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
  mockWritingQuerySchema,
  mockWritingSchema,
} from "../schemas/mocks";
import { goalPathParamsSchema, mockPathParamsSchema } from "../schemas/paths";
import { planChangedWhileSavingResponse } from "../schemas/plan-errors";
import {
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  paymentRequiredResponse,
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
  "/goals/{goalId}/mock-writing": {
    get: {
      description:
        "The run writing the paper of a mock that is being prepared, for the wait on the mock chooser and on a scheduled mock's intro: the anytime mock the learner last asked to start, or the scheduled one named by `planItemId`. A supply run can write several papers. Each paper has its own stream namespace, whether supply started in the background or after a learner asked to start. Ask again every few seconds while `status` is `starting`. Only reads: it never starts a run. Uncached.",
      operationId: "getMockWriting",
      requestParams: { path: goalPathParamsSchema, query: mockWritingQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mockWritingSchema } },
          description: "Whether a run is writing the paper",
        },
        ...commonErrors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get the run writing a mock's questions",
      tags: TAGS,
    },
  },
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
        "403": forbiddenResponse,
        "409": {
          ...conflictResponse,
          description:
            "The goal is paused, or the written test requires an exam choice (`EXAM_CHOICE_REQUIRED`, with `details.choiceGroups`)",
        },
        "422": {
          ...unprocessableEntityResponse,
          description: "The goal is not an exam or does not offer the requested option",
        },
        "429": {
          content: {
            "application/json": {
              schema: z.object({
                error: z
                  .object({
                    code: z.literal("USAGE_LIMIT_REACHED"),
                    details: z.object({ returnsOn: z.iso.date() }),
                    message: z.string(),
                  })
                  .optional(),
                returnsOn: z.iso.date(),
                status: z.literal("limitReached"),
              }),
            },
          },
          description:
            "The extra writing allowance is used for the day. `error.details.returnsOn` is the date it renews.",
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
        "Grades a finished mock's submitted writing tasks using the admissions issued at its start. Each answer is graded once, and concurrent requests replay the saved results.",
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
        "The learner's yes to what a finished mock offers (`adapt` on GET /mocks/{blockId}), never applied without it: `skip` tests out the plan's lessons on the topics the mock showed they know (every question on them right, at least three), as a change with an undo. `unchanged` when nothing moved.",
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
        "409": planChangedWhileSavingResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Change the plan from a mock",
      tags: TAGS,
    },
  },
};

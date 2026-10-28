import {
  mockAnswerInputSchema,
  mockPlayInputSchema,
} from "@zoonk/core/exams/mocks/answer-contract";
import { mockTimeZoneInputSchema } from "@zoonk/core/exams/mocks/contract";
import { speakingSectionViewSchema } from "@zoonk/core/language/exam-speaking/contract";
import { mockStepResponseSchema } from "../schemas/mock-exam";
import { mockPlayResponseSchema } from "../schemas/mock-parts";
import { mockPathParamsSchema, mockSectionPathParamsSchema } from "../schemas/paths";
import {
  conflictResponse,
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

export const mockSittingPaths = {
  "/mocks/{blockId}/answers": {
    put: {
      description:
        "Saves a draft answer in the running section, like marking an answer sheet: a pick (an essay's text so far, `{ text }`, for a full mock's written part) or null for blank, whether it's flagged to come back to (which also marks it unsure, for calibration) and the time spent. Nothing is graded until the mock ends. A section whose time ran out takes no more answers. A forward-only section (`sections[].navigation.forwardOnly`) keeps the answer of a question left behind (its time and flag still save), but for the changes its end review allows (`current.changesLeft`).",
      operationId: "saveMockAnswer",
      requestBody: {
        content: { "application/json": { schema: mockAnswerInputSchema } },
        required: true,
      },
      requestParams: { path: mockPathParamsSchema },
      responses: {
        "204": { description: "Saved" },
        ...commonErrors,
        "409": {
          ...conflictResponse,
          description:
            "The mock isn't running, the time ran out, or a forward-only section keeps that answer (MOCK_ANSWER_LOCKED)",
        },
        "422": { ...unprocessableEntityResponse, description: "Not in the running section" },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Save a mock answer",
      tags: TAGS,
    },
  },
  "/mocks/{blockId}/break-ends": {
    post: {
      description:
        "Ends the break between two sections now (`breakUntil` on GET /mocks/{blockId}), like walking back into the room early: the next section's clock starts. Once the break runs out, the clock starts on its own.",
      operationId: "endMockBreak",
      requestParams: { path: mockPathParamsSchema },
      responses: {
        "204": { description: "The next section's clock started" },
        ...commonErrors,
        "409": { ...conflictResponse, description: "The mock isn't on a break" },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "End a mock's break",
      tags: TAGS,
    },
  },
  "/mocks/{blockId}/plays": {
    post: {
      description:
        "Counts a play of one of the running listening section's recordings as it starts (`current.kind` `listening`; the question's `set.id`). The exam plays each recording a set number of times (`set.listening.plays`) and gives none back, so the count lives on the mock: GET /mocks/{blockId} returns it in `current.plays`, the same in any tab or device. A play past the limit is refused (MOCK_PLAYS_USED): stop the recording.",
      operationId: "recordMockPlay",
      requestBody: {
        content: { "application/json": { schema: mockPlayInputSchema } },
        required: true,
      },
      requestParams: { path: mockPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mockPlayResponseSchema } },
          description: "The play counted",
        },
        ...commonErrors,
        "409": {
          ...conflictResponse,
          description:
            "The recording has no plays left (MOCK_PLAYS_USED), or the section isn't running",
        },
        "422": {
          ...unprocessableEntityResponse,
          description: "Not a recording of the running listening section",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Count a mock recording's play",
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
          description:
            "The next section started, the mock finished, or it expired (its time ran out while the learner was away)",
        },
        ...commonErrors,
        "409": { ...conflictResponse, description: "Not the running section" },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Hand in a mock section",
      tags: TAGS,
    },
  },
  "/mocks/{blockId}/speaking": {
    post: {
      description:
        "Starts the running mock's speaking section (`current.kind` `speaking`) once the learner reaches it: the exam's speaking paper, every task's card written now (about 20-40 seconds), each task a live call to open in turn (`tasks[].conversationId`: GET /language-conversations/{conversationId}, then POST its connections). The paper is kept on the mock: starting again returns the same one, also as `speaking` on GET /mocks/{blockId}. Hand the section in as any other once its calls are done.",
      operationId: "startMockSpeaking",
      requestParams: { path: mockPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: speakingSectionViewSchema } },
          description: "The mock's speaking paper",
        },
        ...commonErrors,
        "402": { ...paymentRequiredResponse, description: "Mock exams come with Plus" },
        "409": {
          ...conflictResponse,
          description: "The mock isn't running its speaking section (MOCK_NOT_SPEAKING)",
        },
        "503": {
          ...conflictResponse,
          description: "Calls are paused (CALLS_PAUSED); no task cards are generated.",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Start a mock's speaking section",
      tags: TAGS,
    },
  },
};

import { essayGradeSchema, essaySubmissionInputSchema } from "@zoonk/core/exams/essays/contract";
import { mockAnswerInputSchema, mockTimeZoneInputSchema } from "@zoonk/core/exams/mocks/contract";
import { examResultInputSchema } from "@zoonk/core/exams/results/contract";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { essayViewResponseSchema } from "../schemas/essays";
import {
  examResultResponseSchema,
  examViewResponseSchema,
  mockStepResponseSchema,
  mockViewResponseSchema,
} from "../schemas/exams";
import { replacementGoalResponseSchema } from "../schemas/goals";
import {
  essayPathParamsSchema,
  goalPathParamsSchema,
  mockPathParamsSchema,
  mockSectionPathParamsSchema,
} from "../schemas/paths";
import {
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
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

export const examPaths = {
  "/essays/{blockId}": {
    get: {
      description:
        "A writing block of the learner's session (produce): an exam's essay prompt, the rubric it's graded with (ENEM's five competencies, OAB's brief section by section, or the item's criteria) and the graded drafts so far, latest first, with how many grades are left today.",
      operationId: "getEssay",
      requestParams: { path: essayPathParamsSchema, query: studySessionTimeZoneInputSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: essayViewResponseSchema } },
          description: "The writing block",
        },
        ...commonErrors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a writing block",
      tags: TAGS,
    },
  },
  "/essays/{blockId}/submissions": {
    post: {
      description:
        "Grades a draft with the official rubric and records it as learning: every criterion with a comment on the learner's own words, an estimated range and one next step. Rewriting sends a new draft. Finish the block through the study session's block endpoints.",
      operationId: "submitEssay",
      requestBody: {
        content: { "application/json": { schema: essaySubmissionInputSchema } },
        required: true,
      },
      requestParams: { path: essayPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: essayGradeSchema } },
          description: "The grade",
        },
        ...commonErrors,
        "409": { ...conflictResponse, description: "Start the block first" },
        "429": { ...tooManyRequestsResponse, description: "Today's essay grades are used up" },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Send an essay for grading",
      tags: TAGS,
    },
  },
  "/goals/{goalId}/exam": {
    get: {
      description:
        "The exam screen for an exam goal: the exam's days with start times, where the learner stands against them (preparing, final stretch, the day before, exam day, after), the exam map (subjects with weights, topics with how often the board asks them, the learner's level per subject), how it's scored with the learner's Cebraspe calibration, the mocks so far, the estimated score after a mock (a range labeled Estimated) and the official result once reported.",
      operationId: "getExam",
      requestParams: { path: goalPathParamsSchema, query: studySessionTimeZoneInputSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: examViewResponseSchema } },
          description: "The exam screen",
        },
        ...commonErrors,
        "422": { ...unprocessableEntityResponse, description: "The goal isn't an exam" },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get the exam screen",
      tags: TAGS,
    },
  },
  "/goals/{goalId}/exam-moves": {
    post: {
      description:
        '"Pass an exam" inside a language goal: when the goal\'s reason names a language certificate (IELTS, TOEFL, DELE, Celpe-Bras…), it moves to an exam goal for it with the same language, details and schedule; research and the curriculum start, and the language goal is archived.',
      operationId: "moveLanguageGoalToExam",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "201": {
          content: { "application/json": { schema: replacementGoalResponseSchema } },
          description: "The new exam goal",
        },
        ...commonErrors,
        "409": { ...conflictResponse, description: "The exam goal couldn't be created" },
        "422": {
          ...unprocessableEntityResponse,
          description: "Not a language goal whose reason names an exam",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Move a language goal to its exam",
      tags: TAGS,
    },
  },
  "/goals/{goalId}/exam-result": {
    put: {
      description:
        '"How did it go?": the official result after the exam (a score on its scale, whether the learner passed, or both), stored next to the estimate shown before so future estimates for the exam can be calibrated. Reporting again replaces it. It opens on the first exam day.',
      operationId: "reportExamResult",
      requestBody: {
        content: { "application/json": { schema: examResultInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema, query: studySessionTimeZoneInputSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: examResultResponseSchema } },
          description: "The stored result",
        },
        ...commonErrors,
        "409": { ...conflictResponse, description: "The exam hasn't happened yet" },
        "422": { ...unprocessableEntityResponse, description: "The goal isn't an exam" },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Report the official exam result",
      tags: TAGS,
    },
  },
  "/mocks/{blockId}": {
    get: {
      description:
        "A mock exam in real conditions, by the study session block that scheduled it (an exam goal's weekly Big Challenge): before it starts, its sections in the exam's order with questions, minutes, scoring and when the real exam starts; while it runs, the current section's questions (never the answers), its deadline and the saved drafts; once finished, what it showed (the exam's own score, estimated where it's an estimate, time per question against the pace, IRT coherence or Cebraspe calibration), mistakes by cause and the questions to review.",
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
        "Ends the mock now, like leaving the exam early: unanswered questions count as blank, and it's graded, recorded in the learner model and settled in the session.",
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

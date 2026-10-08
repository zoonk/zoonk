import { essayGradeSchema, essaySubmissionInputSchema } from "@zoonk/core/exams/essays/contract";
import { examResultInputSchema } from "@zoonk/core/exams/results/contract";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { essayViewResponseSchema } from "../schemas/essays";
import { examResultResponseSchema, examViewResponseSchema } from "../schemas/exams";
import { replacementGoalResponseSchema } from "../schemas/goals";
import { essayPathParamsSchema, goalPathParamsSchema } from "../schemas/paths";
import {
  conflictResponse,
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
};

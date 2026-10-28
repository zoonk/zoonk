import { examChoiceInputSchema } from "@zoonk/core/exams/choices/contract";
import { essayGradeSchema, essaySubmissionInputSchema } from "@zoonk/core/exams/essays/contract";
import { examResultInputSchema } from "@zoonk/core/exams/results/contract";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { essayViewResponseSchema } from "../schemas/essays";
import { examResultResponseSchema, examViewResponseSchema } from "../schemas/exams";
import { replacementGoalResponseSchema } from "../schemas/goals";
import { essayPathParamsSchema, goalPathParamsSchema } from "../schemas/paths";
import { planChangeInvalidResponse } from "../schemas/plan-errors";
import { planChangeResultSchema } from "../schemas/plans";
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
        '"Pass an exam" inside a language goal: when the goal\'s reason names a language certificate (IELTS, TOEFL, DELE, Celpe-Bras…), it moves to an exam goal for it with the same language, details and schedule; research and the curriculum start, and the language goal is archived. Answering the reason question in onboarding (`POST /goals/{goalId}/onboarding/answers`) already does this, so onboarding never needs this call.',
      operationId: "moveLanguageGoalToExam",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: replacementGoalResponseSchema } },
          description: "The goal had already moved: its exam goal, with nothing started again",
        },
        "201": {
          content: { "application/json": { schema: replacementGoalResponseSchema } },
          description: "The new exam goal",
        },
        ...commonErrors,
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
  "/goals/{goalId}/plan/exam-choices": {
    post: {
      description:
        "The option the learner takes of one of their exam's choices, such as ENEM's foreign language (English or Spanish), from `examChoices` on the plan or onboarding. The plan, practice and mocks then study that option and no other of the choice; until the learner picks, they study none. It re-plans from today and can be undone like any plan change; picking the option they already take changes nothing (`change` is null, as it is while the plan is being built). 422 PLAN_CHANGE_INVALID with reason unknownOption when the exam has no such choice or option.",
      operationId: "createPlanExamChoice",
      requestBody: {
        content: { "application/json": { schema: examChoiceInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...commonErrors,
        "200": {
          content: { "application/json": { schema: planChangeResultSchema } },
          description: "The applied change",
        },
        "422": planChangeInvalidResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Choose an option of an exam's choice",
      tags: ["Plans"],
    },
  },
};

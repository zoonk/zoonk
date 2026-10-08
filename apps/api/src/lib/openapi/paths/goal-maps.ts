import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { chapterViewSchema } from "@zoonk/core/view-models/chapter/contract";
import { fieldMapViewSchema } from "@zoonk/core/view-models/map/contract";
import { syllabusViewSchema } from "@zoonk/core/view-models/syllabus/contract";
import { studySessionErrorCodes } from "../../study-session-errors";
import { replacementGoalResponseSchema } from "../schemas/goals";
import { areaPracticeResponseSchema } from "../schemas/learn-views";
import { goalChapterPathParamsSchema, goalPathParamsSchema } from "../schemas/paths";
import {
  conflictResponse,
  notFoundResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

const readErrors = {
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "404": notFoundResponse,
};

/** The map of the field, the syllabus, each chapter's page, refresh mode and what to study next. */
export const goalMapPaths = {
  "/goals/{goalId}/chapters/{chapterId}": {
    get: {
      description:
        "A chapter of the learner's plan: its map (the chapter's skills linked by prerequisites, each with its mastery and idea), its lessons with the next one to open, open mistakes on its skills and the summary cards its finished lessons left. \"Practice\" is `POST /v1/goals/{goalId}/area-practice` with the chapter id as `areaId`. A chapter outside the plan isn't found.",
      operationId: "getGoalChapter",
      requestParams: { path: goalChapterPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: chapterViewSchema } },
          description: "The chapter",
        },
        ...readErrors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a chapter of a goal's plan",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/map": {
    get: {
      description:
        "The map of the field for a goal, drawn by code from its skill graph: every skill with its mastery (New, Learning, Solid, Mastered, fading) and prerequisites, grouped by chapter, phase and course, with where the learner is now. It also carries refresh mode (the skills fading now, first for refresh goals), the course the plan is built from with its levels, and, once every lesson is done, what to study next.",
      operationId: "getGoalMap",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: fieldMapViewSchema } },
          description: "The goal's map",
        },
        ...readErrors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a goal's map",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/next-level": {
    post: {
      description:
        "\"Continue at Beginner\" once every lesson of a learn goal's plan is done: the goal is completed and a goal for the next level of its course takes its place, with the same time, study days and what onboarding understood, so nothing is asked again. It isn't another goal against the plan's limits. Research and the curriculum start right away.",
      operationId: "continueGoalAtNextLevel",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "201": {
          content: { "application/json": { schema: replacementGoalResponseSchema } },
          description: "The goal for the next level",
        },
        ...readErrors,
        "409": {
          ...conflictResponse,
          description: "The plan still has lessons to do, or the new goal couldn't be created",
        },
        "422": {
          ...unprocessableEntityResponse,
          description: "Not a learn goal, or its course has no level after the plan's",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Continue a goal at the next level",
      tags: ["Goals"],
    },
  },
  "/goals/{goalId}/refresh-practice": {
    post: {
      description:
        "\"Review\" on Content: the block of today's session that reviews the goal's skills that are fading or due today when one is still to do; otherwise a bonus block of practice on them, weakest first, added to today's session. A bonus block counts as extra time: at most two a day, never past the daily time limit, with capped Brain Power. Tapping again returns the same unfinished block.",
      operationId: "createRefreshPractice",
      requestBody: { content: { "application/json": { schema: studySessionTimeZoneInputSchema } } },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "201": {
          content: { "application/json": { schema: areaPracticeResponseSchema } },
          description: "The practice block and its session",
        },
        ...readErrors,
        "409": {
          ...conflictResponse,
          description: `The goal is paused or finished (${studySessionErrorCodes.goalNotActive}), or no more bonus time today, including the daily time limit (${studySessionErrorCodes.extraTimeUnavailable}, details.reason says why).`,
        },
        "422": {
          ...unprocessableEntityResponse,
          description: `Nothing is fading or due today. Error code: ${studySessionErrorCodes.nothingToPractice}.`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Review fading and due skills",
      tags: ["Study sessions"],
    },
  },
  "/goals/{goalId}/syllabus": {
    get: {
      description:
        "The structure of a goal, in the learner's terms, so they can see all of it and trust it's complete. For an exam whose plan follows its notice: the notice's subjects in its order (grouped as the notice groups them, such as P1 and P2), each with its topics in the notice's own words, progress from the plan's lessons, when the plan studies it next and the chapters that teach it; areas the plan adds outside the notice come after. Topics get a status (studied, in progress, to study, not in the plan and why) only when the plan says which skills teach which topic. For other goals: the plan's modules in teaching order with their chapters. A goal without a plan yet isn't found.",
      operationId: "getGoalSyllabus",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: syllabusViewSchema } },
          description: "The goal's syllabus",
        },
        ...readErrors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a goal's syllabus",
      tags: ["Learner"],
    },
  },
};

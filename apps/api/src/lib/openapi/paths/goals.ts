import { goalCreateInputSchema, goalUpdateInputSchema } from "@zoonk/core/goals/contract";
import {
  goalCreateResponseSchema,
  goalListResponseSchema,
  goalSchema,
  goalUpdateResponseSchema,
} from "../schemas/goals";
import { goalPathParamsSchema } from "../schemas/paths";
import {
  notFoundResponse,
  tooManyRequestsResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

const goalErrors = {
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "404": notFoundResponse,
} as const;

export const goalPaths = {
  "/goals": {
    get: {
      description:
        "The learner's goals that aren't archived: the main goal first (the one the tabs show, whose session comes first), with the day's total minutes across active goals.",
      operationId: "listGoals",
      responses: {
        "200": {
          content: { "application/json": { schema: goalListResponseSchema } },
          description: "The learner's goals",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List goals",
      tags: ["Goals"],
    },
    post: {
      description:
        "Creates one goal, or several that share the day's minutes (the first is the main goal and gets twice each other's share), each with an empty plan the planner fills. Each goal counts against the learner's plan (free learners follow one active goal); goals the plan allows are created even when a later one isn't, and 429 means none was. The first new goal becomes the one the tabs show. Research starts for exam and learn goals.",
      operationId: "createGoals",
      requestBody: {
        content: { "application/json": { schema: goalCreateInputSchema } },
        required: true,
      },
      responses: {
        "201": {
          content: { "application/json": { schema: goalCreateResponseSchema } },
          description: "The goals created, the ones refused and the research started",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "422": unprocessableEntityResponse,
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Create goals",
      tags: ["Goals"],
    },
  },
  "/goals/{goalId}": {
    get: {
      description: "One of the learner's goals with a short summary of its plan.",
      operationId: "getGoal",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...goalErrors,
        "200": { content: { "application/json": { schema: goalSchema } }, description: "The goal" },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a goal",
      tags: ["Goals"],
    },
    patch: {
      description:
        "Edits a goal. A new daily time, study days or date re-plans from today (past work never moves) and returns the plan change, which can be undone. Status pauses, resumes, archives or completes the goal: resuming counts against the learner's active goals, and archiving the goal the tabs show moves them to another active goal.",
      operationId: "updateGoal",
      requestBody: {
        content: { "application/json": { schema: goalUpdateInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...goalErrors,
        "200": {
          content: { "application/json": { schema: goalUpdateResponseSchema } },
          description: "The goal and the plan change it made, if any",
        },
        "422": unprocessableEntityResponse,
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Update a goal",
      tags: ["Goals"],
    },
  },
};

import {
  planChangeDecisionInputSchema,
  planChangeInputSchema,
  planEditRequestInputSchema,
  planToolChoiceInputSchema,
} from "@zoonk/core/plans/contract";
import { planLinkStartInputSchema } from "@zoonk/core/plans/link-contract";
import { ownLevelChangeInputSchema } from "@zoonk/core/plans/own-level-contract";
import { goalSchema } from "../schemas/goals";
import {
  goalPathParamsSchema,
  planChangePathParamsSchema,
  planLinkPathParamsSchema,
} from "../schemas/paths";
import {
  ownLevelChangeSchema,
  planChangeResultSchema,
  planChangeSchema,
  planLinkResponseSchema,
  planResponseSchema,
} from "../schemas/plans";
import {
  conflictResponse,
  notFoundResponse,
  smallAiHelpRefusalResponses,
  tooManyRequestsResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY, OPTIONAL_AUTHENTICATION_SECURITY } from "../security";

const planErrors = {
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "404": notFoundResponse,
} as const;

export const planPaths = {
  "/goals/{goalId}/plan": {
    get: {
      description:
        "The plan at every zoom level for both modes: each phase with the current one chapter by chapter, this week day by day, the status (on track, ahead, a bit behind with the fix, or needs adjusting), the estimate and its pace, what fits in the learner's time and what more time would change, the areas to focus on or skip, and recent changes with proposals waiting for an OK. Free exam plans mark mocks and days past the first week as Plus.",
      operationId: "getGoalPlan",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...planErrors,
        "200": {
          content: { "application/json": { schema: planResponseSchema } },
          description: "The plan",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a goal's plan",
      tags: ["Plans"],
    },
  },
  "/goals/{goalId}/plan/changes": {
    post: {
      description:
        "Applies a change the learner made in the plan: daily time, a weekday's time or a rest day, a light week, the date, areas to focus on, skip or bring back, or steering. It re-plans from today and can be undone.",
      operationId: "createPlanChange",
      requestBody: {
        content: { "application/json": { schema: planChangeInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...planErrors,
        "200": {
          content: { "application/json": { schema: planChangeResultSchema } },
          description: "The applied change",
        },
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Change a plan",
      tags: ["Plans"],
    },
  },
  "/goals/{goalId}/plan/changes/{changeId}": {
    patch: {
      description:
        "The learner's answer to a change: applied or declined for a proposal, undone for the latest applied edit or a test-out (while the plan is still as it left it). 409 when the change was already answered or the plan moved on.",
      operationId: "decidePlanChange",
      requestBody: {
        content: { "application/json": { schema: planChangeDecisionInputSchema } },
        required: true,
      },
      requestParams: { path: planChangePathParamsSchema },
      responses: {
        ...planErrors,
        "200": {
          content: { "application/json": { schema: planChangeSchema } },
          description: "The change",
        },
        "409": conflictResponse,
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Answer or undo a plan change",
      tags: ["Plans"],
    },
  },
  "/goals/{goalId}/plan/edit-requests": {
    post: {
      description:
        'Changes the plan from plain words, such as "less on weekends" or "focus on math". A change of at most one lesson applies at once with an undo; anything bigger comes back proposed, with its effect on the end date, waiting for the learner\'s OK. 422 PLAN_EDIT_NOT_UNDERSTOOD when the words aren\'t a plan change.',
      operationId: "createPlanEditRequest",
      requestBody: {
        content: { "application/json": { schema: planEditRequestInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...planErrors,
        "200": {
          content: { "application/json": { schema: planChangeResultSchema } },
          description: "The change, applied or proposed",
        },
        "422": unprocessableEntityResponse,
        ...smallAiHelpRefusalResponses,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Change a plan in plain words",
      tags: ["Plans"],
    },
  },
  "/goals/{goalId}/plan/own-level": {
    put: {
      description:
        "Changes the learner's own level (nothing yet, basic, intermediate or advanced) from the plan. Past work is never undone: known skills and passed test-outs stay. A lower level adds the foundations the plan left out, right before the skills they prepare for, as a change with an undo. A higher level skips nothing: it returns test-outs for the chapters the new level covers. Placement starts from the new level.",
      operationId: "updateOwnLevel",
      requestBody: {
        content: { "application/json": { schema: ownLevelChangeInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...planErrors,
        "200": {
          content: { "application/json": { schema: ownLevelChangeSchema } },
          description: "The new level, with the foundations added or the test-outs offered",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Change your own level",
      tags: ["Plans"],
    },
  },
  "/goals/{goalId}/plan/tool-choices": {
    post: {
      description:
        "The learner's answer on the plan's \"You'll use\" card for one or more of its tools: they have it, they'll set it up on their device, or they'll go without (examples only, no practice on their own computer). Setting a tool up adds a short setup lesson for that tool and device right before the first chapter that uses it; any other answer takes back a setup lesson an earlier answer added. It re-plans from today and can be undone like any plan change. 422 PLAN_CHANGE_INVALID with reason unknownTool when a tool isn't in the plan.",
      operationId: "createPlanToolChoice",
      requestBody: {
        content: { "application/json": { schema: planToolChoiceInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...planErrors,
        "200": {
          content: { "application/json": { schema: planChangeResultSchema } },
          description: "The applied change",
        },
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Choose how to use a plan's tools",
      tags: ["Plans"],
    },
  },
  "/plan-links/{planId}": {
    get: {
      description:
        "What a shared plan link shows anyone: the subject (a public course or exam) and the plan's shape, never who made it, their dates, pace, answers or progress. The owner is told the link is theirs. Not for indexing.",
      operationId: "getPlanLink",
      requestParams: { path: planLinkPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: planLinkResponseSchema } },
          description: "The plan's outline",
        },
        "400": validationErrorResponse,
        "404": notFoundResponse,
      },
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Get a plan link",
      tags: ["Plans"],
    },
  },
  "/plan-links/{planId}/goals": {
    post: {
      description:
        "Starts the viewer's own goal from a plan link: the same kind, subject and exam, and the plan's public structure planned at the viewer's time. A new goal's run starts writing ahead what its plan needs (placement's questions, the first lessons); follow it through GET /goals/{goalId}/onboarding (`generationId`), or POST /goals/{goalId}/generations when it didn't start. Guests can start one. The owner gets their goal back (200). 422 PLAN_LINK_TITLE_REQUIRED when the plan has no public subject and no title was sent.",
      operationId: "createGoalFromPlanLink",
      requestBody: {
        content: { "application/json": { schema: planLinkStartInputSchema } },
        required: true,
      },
      requestParams: { path: planLinkPathParamsSchema },
      responses: {
        ...planErrors,
        "200": {
          content: { "application/json": { schema: goalSchema } },
          description: "The owner's goal",
        },
        "201": {
          content: { "application/json": { schema: goalSchema } },
          description: "The new goal",
        },
        "422": unprocessableEntityResponse,
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Start a goal from a plan link",
      tags: ["Plans"],
    },
  },
};

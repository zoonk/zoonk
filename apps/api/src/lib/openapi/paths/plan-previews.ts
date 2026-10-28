import { planChangeInputSchema } from "@zoonk/core/plans/contract";
import { planChangePreviewSchema } from "@zoonk/core/plans/preview-contract";
import { z } from "zod";
import { goalPathParamsSchema } from "../schemas/paths";
import { planDateChangeInvalidResponse } from "../schemas/plan-errors";
import {
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const planPreviewPaths = {
  "/goals/{goalId}/plan/change-previews": {
    post: {
      description:
        "What a change would do before the learner makes it, with nothing saved: planned from today as `POST /goals/{goalId}/plan/changes` plans it, its effect (lessons added or removed, when the plan ends, the notice topics it brings in or leaves out) and what the learner's time would cover. Show it before they confirm a change with a bigger effect, such as the bases' choices (`setBaseChoices`) or studying everything (`setFullCourse`, `setTargetDate` null).",
      operationId: "previewPlanChange",
      requestBody: {
        content: { "application/json": { schema: planChangeInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: planChangePreviewSchema } },
          description: "What the change would do",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "422": planDateChangeInvalidResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Preview a plan change",
      tags: ["Plans"],
    },
  },
  "/goals/{goalId}/plan/resume-preview": {
    get: {
      description:
        "Whether resuming a paused goal needs confirmation because lessons were planned for the paused days. The read saves nothing. PATCH /goals/{goalId} with status active computes and saves the actual move from current inputs. False when the plan stays as it is or the goal is not paused.",
      operationId: "previewGoalResume",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: z.boolean() } },
          description: "What resuming would do",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Preview resuming a goal",
      tags: ["Plans"],
    },
  },
};

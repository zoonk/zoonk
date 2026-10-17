import { planChangeInputSchema } from "@zoonk/core/plans/contract";
import { planChangePreviewSchema } from "@zoonk/core/plans/preview-contract";
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
        "What resuming a paused goal would do to its plan, with nothing saved. A pause that left nothing behind (resumed the same day, or over rest days only) keeps the plan as it is (`unchanged`). When the pause left lessons on days now past, resuming plans again from today, as `PATCH /goals/{goalId}` with `status: active` does: show its effect where the learner resumes. A goal that isn't paused is `unchanged`.",
      operationId: "previewGoalResume",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: planChangePreviewSchema } },
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

import { planChangeInputSchema } from "@zoonk/core/plans/contract";
import { planChangePreviewSchema } from "@zoonk/core/plans/preview-contract";
import { goalPathParamsSchema } from "../schemas/paths";
import {
  notFoundResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
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
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Preview a plan change",
      tags: ["Plans"],
    },
  },
};

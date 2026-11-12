import {
  contentFixApprovalOptionsResponseSchema,
  contentFixDecisionRequestSchema,
  contentFixDecisionResponseSchema,
  contentFixPathParamsSchema,
} from "../schemas/content-fixes";
import {
  forbiddenResponse,
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

const errorResponses = {
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "403": forbiddenResponse,
  "404": notFoundResponse,
};

export const contentFixPaths = {
  "/content-fixes/{fixId}/approval-options": {
    post: {
      description:
        "Starts approving a proposed content fix: a single-use challenge for one of the signed-in staff person's own passkeys, with user verification. Asking again replaces the challenge. Staff sessions only; a CLI login can't approve.",
      operationId: "createContentFixApprovalOptions",
      requestParams: { path: contentFixPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: contentFixApprovalOptionsResponseSchema } },
          description: "The options to sign, or why there's nothing to sign",
        },
        ...errorResponses,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Start approving a content fix (staff)",
      tags: ["Content fixes"],
    },
  },
  "/content-fixes/{fixId}/decisions": {
    post: {
      description:
        "Approves a proposed content fix with a passkey assertion over its challenge, or rejects it. Approving applies exactly the recorded change, only while every field still holds its recorded value; otherwise the fix ends stale and nothing changes. A repeat returns what was decided first. Staff sessions only; a CLI login can't decide.",
      operationId: "createContentFixDecision",
      requestBody: { content: { "application/json": { schema: contentFixDecisionRequestSchema } } },
      requestParams: { path: contentFixPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: contentFixDecisionResponseSchema } },
          description: "What was decided, or why the approval wasn't accepted",
        },
        ...errorResponses,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Approve or reject a content fix (staff)",
      tags: ["Content fixes"],
    },
  },
};

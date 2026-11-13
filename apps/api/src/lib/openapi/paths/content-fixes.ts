import {
  contentFixApprovalOptionsRequestSchema,
  contentFixApprovalOptionsResponseSchema,
  contentFixBatchDecisionRequestSchema,
  contentFixBatchPathParamsSchema,
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
  "/content-fix-batches/{batchId}/approval-options": {
    post: {
      description:
        "Starts approving the selected proposed fixes of a batch: one single-use challenge for one of the signed-in staff person's own passkeys, with user verification, stored on exactly those fixes. Asking again replaces it. Staff sessions only; a CLI login can't approve.",
      operationId: "createContentFixApprovalOptions",
      requestBody: {
        content: { "application/json": { schema: contentFixApprovalOptionsRequestSchema } },
      },
      requestParams: { path: contentFixBatchPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: contentFixApprovalOptionsResponseSchema } },
          description: "The options to sign, or why there's nothing to sign",
        },
        ...errorResponses,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Start approving content fixes (staff)",
      tags: ["Content fixes"],
    },
  },
  "/content-fix-batches/{batchId}/decisions": {
    post: {
      description:
        "Approves the batch's fixes that hold the challenge a passkey assertion signed, then applies each in its own transaction, in proposal order: a fix applies only while every field still holds its recorded value, and otherwise ends stale with nothing changed. `resume` applies what the same approver already approved but didn't finish. A repeat returns where the batch stands. Staff sessions only; a CLI login can't decide.",
      operationId: "createContentFixBatchDecision",
      requestBody: {
        content: { "application/json": { schema: contentFixBatchDecisionRequestSchema } },
      },
      requestParams: { path: contentFixBatchPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: contentFixDecisionResponseSchema } },
          description: "Where each fix of the batch stands, or why the approval wasn't accepted",
        },
        ...errorResponses,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Approve content fixes (staff)",
      tags: ["Content fixes"],
    },
  },
  "/content-fixes/{fixId}/decisions": {
    post: {
      description:
        "Rejects one proposed content fix. It needs no passkey, since it changes no content. A repeat returns what was decided first. Staff sessions only; a CLI login can't decide.",
      operationId: "createContentFixDecision",
      requestBody: { content: { "application/json": { schema: contentFixDecisionRequestSchema } } },
      requestParams: { path: contentFixPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: contentFixDecisionResponseSchema } },
          description: "Where the fix stands",
        },
        ...errorResponses,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Reject a content fix (staff)",
      tags: ["Content fixes"],
    },
  },
};

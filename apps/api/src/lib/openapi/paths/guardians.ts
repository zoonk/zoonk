import {
  guardedLearnerUpdateSchema,
  guardianInviteAcceptanceSchema,
  guardianInviteSchema,
} from "@zoonk/core/minors/guardian/contract";
import { accessErrorCodes } from "../../access-error-codes";
import {
  guardedLearnerListResponseSchema,
  guardianInviteAcceptanceResponseSchema,
  guardianLinkListResponseSchema,
  guardianLinkPathParamsSchema,
  guardianLinkResponseSchema,
} from "../schemas/guardians";
import {
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  tooManyRequestsResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

const TAGS = ["Guardians"];

const guardedLearnerNotFoundResponse = {
  ...notFoundResponse,
  description: "No active guardian link for the signed-in guardian",
} as const;

export const guardianPaths = {
  "/me/guarded-learners": {
    get: {
      operationId: "listGuardedLearners",
      responses: {
        "200": {
          content: { "application/json": { schema: guardedLearnerListResponseSchema } },
          description: "Learners the signed-in account guards, with their last seven days",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List learners the current user guards",
      tags: TAGS,
    },
  },
  "/me/guarded-learners/{linkId}": {
    patch: {
      operationId: "updateGuardedLearner",
      requestBody: {
        content: { "application/json": { schema: guardedLearnerUpdateSchema } },
        required: true,
      },
      requestParams: { path: guardianLinkPathParamsSchema },
      responses: {
        "204": { description: "Controls saved" },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": guardedLearnerNotFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Set a guarded learner's daily time limit or turn their memory off",
      tags: TAGS,
    },
  },
  "/me/guarded-learners/{linkId}/plus-approval": {
    post: {
      operationId: "approveGuardedLearnerPlus",
      requestParams: { path: guardianLinkPathParamsSchema },
      responses: {
        "204": { description: "Plus approved for the learner" },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": guardedLearnerNotFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Approve Plus for a guarded learner",
      tags: TAGS,
    },
  },
  "/me/guardian-invite-acceptances": {
    post: {
      operationId: "acceptGuardianInvite",
      requestBody: {
        content: { "application/json": { schema: guardianInviteAcceptanceSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: guardianInviteAcceptanceResponseSchema } },
          description: "Invite accepted; accepting again is harmless",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "403": {
          ...forbiddenResponse,
          description: `Sign in with the invited, verified email. Error codes: ${accessErrorCodes.emailNotVerified}, ${accessErrorCodes.guardianEmailMismatch}.`,
        },
        "404": notFoundResponse,
        "422": {
          ...unprocessableEntityResponse,
          description: `The invite expired. Error code: ${accessErrorCodes.guardianInviteExpired}.`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Accept a guardian invite",
      tags: TAGS,
    },
  },
  "/me/guardian-invite-dismissals": {
    post: {
      description:
        '"Not now" to the offer to invite a parent or guardian on Today (`guardianInvite`): it stops showing on every device. Inviting from the guardian settings still works. Dismissing again changes nothing.',
      operationId: "dismissGuardianInvite",
      responses: { "204": { description: "Dismissed" }, "401": unauthorizedResponse },
      security: AUTHENTICATED_SECURITY,
      summary: "Dismiss the guardian invite offer",
      tags: TAGS,
    },
  },
  "/me/guardian-links": {
    get: {
      operationId: "listCurrentUserGuardianLinks",
      responses: {
        "200": {
          content: { "application/json": { schema: guardianLinkListResponseSchema } },
          description: "The learner's guardians and pending invites",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List current user's guardians",
      tags: TAGS,
    },
    post: {
      description:
        "Learners under 18 invite a guardian by email. A new invite replaces a pending one, and invites expire after 7 days.",
      operationId: "inviteGuardian",
      requestBody: {
        content: { "application/json": { schema: guardianInviteSchema } },
        required: true,
      },
      responses: {
        "201": {
          content: { "application/json": { schema: guardianLinkResponseSchema } },
          description: "Invite sent",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "403": {
          ...forbiddenResponse,
          description: `Guests need an account, and only learners under 18 have guardians. Error codes: ${accessErrorCodes.accountRequired}, ${accessErrorCodes.guardianNotAvailable}.`,
        },
        "429": {
          ...tooManyRequestsResponse,
          description: `Too many invites today. Error code: ${accessErrorCodes.guardianInviteLimitReached}.`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Invite a guardian",
      tags: TAGS,
    },
  },
  "/me/guardian-links/{linkId}": {
    delete: {
      description: "Learners cancel pending invites; guardians end active links.",
      operationId: "revokeGuardianLink",
      requestParams: { path: guardianLinkPathParamsSchema },
      responses: {
        "204": { description: "Link revoked" },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Revoke a guardian link",
      tags: TAGS,
    },
  },
  "/me/plus-approval-requests": {
    post: {
      operationId: "requestPlusApproval",
      responses: {
        "202": { description: "Guardians emailed" },
        "401": unauthorizedResponse,
        "403": {
          ...forbiddenResponse,
          description: `Guests need an account. Error code: ${accessErrorCodes.accountRequired}.`,
        },
        "409": {
          ...conflictResponse,
          description: `Plus can already be purchased. Error code: ${accessErrorCodes.plusApprovalNotNeeded}.`,
        },
        "422": {
          ...unprocessableEntityResponse,
          description: `No active guardian can approve. Error code: ${accessErrorCodes.noGuardian}.`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Ask guardians to approve Plus",
      tags: TAGS,
    },
  },
};

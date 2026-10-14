import {
  liveCallAdmissionInputSchema,
  liveCallAdmissionResponseSchema,
  liveCallCloseAllResponseSchema,
} from "@zoonk/core/language/conversations/admission-contract";
import {
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

const common = { security: AUTHENTICATED_SECURITY, tags: ["Language"] };
const accessErrors = { "401": unauthorizedResponse, "403": forbiddenResponse };

export const liveCallAdminPaths = {
  "/live-calls/admission": {
    get: {
      ...common,
      description:
        "Admins only. Reads admission mode, the free-day dollar cap in micros, and up to 100 connections the provider hasn't confirmed closed: unresolved ones ordered by deadline, then the latest settled by estimate (closed, costConfidence estimated). providerAvailable checks only the API deployment's dedicated key presence; this GET starts no model, provider session or Workflow. All dates are ISO strings. Missing settings default to off.",
      operationId: "getLiveCallAdmission",
      responses: {
        "200": jsonResponse(
          liveCallAdmissionResponseSchema,
          "Admission and unresolved connections",
        ),
        ...accessErrors,
      },
      summary: "Read live-call admission (admins)",
    },
    post: {
      ...common,
      description:
        "Admins only. Sets fresh live-call admission (off/staff/all) and the free accounts' shared UTC-day dollar cap in integer micros. Changing the mode affects the next reserve and SDP redemption without a redeploy; off leaves closure and recovery running. Staff admits admins only. This request starts no provider work.",
      operationId: "updateLiveCallAdmission",
      requestBody: {
        content: { "application/json": { schema: liveCallAdmissionInputSchema } },
        required: true,
      },
      responses: {
        "200": jsonResponse(liveCallAdmissionInputSchema, "The saved admission setting"),
        "400": validationErrorResponse,
        "422": unprocessableEntityResponse,
        ...accessErrors,
      },
      summary: "Update live-call admission (admins)",
    },
  },
  "/live-calls/close-all": {
    post: {
      ...common,
      description:
        "Admins only. Disables admission before closing a bounded batch of up to 25 unresolved connections, prioritizing never-attempted and least-recently-attempted rows. Returns attempted, closed, and remaining counts; closed includes connections settled from a provider receipt and connections without a provider ID closed with an estimated cost. Repeat while remaining is positive. Failed or ambiguous provider closure retains the slot and cost liability; the original deadline run and existing daily sweep keep recovery available. A connection the provider never gave an ID closes once its deadline has passed and its creation request is over, keeping its estimated cost; if its provider ID turns up later, it opens again until a close confirms the real cost. One with an ID that no close confirms closes once its longest run (taken as 2 hours) is over, keeping that whole run's cost; a receipt that still comes replaces the estimate once. No feedback or rewards are awarded.",
      operationId: "closeAllLiveCalls",
      responses: {
        "200": jsonResponse(liveCallCloseAllResponseSchema, "The disabled-admission close batch"),
        ...accessErrors,
      },
      summary: "Disable and close live calls (admins)",
    },
  },
};

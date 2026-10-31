import {
  liveCallAdmissionInputSchema,
  liveCallAdmissionResponseSchema,
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
        "Admins only. Reads admission mode, the free-day dollar cap in micros, and up to 100 connections still open, oldest deadline first, each with its exposure (what it may have cost so far: its reservation or its clock, whichever is more) and overdue (open more than a minute past its deadline, which shows a hangup failing). providerAvailable checks only the API deployment's OpenAI key presence; this GET starts no model, provider session or Workflow. All dates are ISO strings. Missing settings default to off.",
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
        "Admins only. Sets fresh live-call admission (off/staff/all) and the free accounts' shared UTC-day dollar cap in integer micros. Changing the mode affects the next reserve and SDP redemption without a redeploy; with off, calls already live end by their deadline. Staff admits admins only. This request starts no provider work.",
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
};

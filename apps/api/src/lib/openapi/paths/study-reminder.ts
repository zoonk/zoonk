import {
  studyReminderOfferClaimSchema,
  studyReminderOfferResultSchema,
  studyReminderPhoneSchema,
  studyReminderResponseSchema,
  studyReminderUpdateSchema,
} from "@zoonk/core/reminders/contract";
import { z } from "zod";
import { accessErrorCodes } from "../../access-error-codes";
import {
  badRequestResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import {
  studyReminderUnsubscribeQuerySchema,
  studyReminderUnsubscribeResponseSchema,
} from "../schemas/study-reminder";
import { AUTHENTICATED_SECURITY, PUBLIC_SECURITY } from "../security";

const reminderResponse = {
  content: { "application/json": { schema: studyReminderResponseSchema } },
  description: "Every reminder setting as saved",
};

const oneClickBodySchema = z
  .object({ "List-Unsubscribe": z.literal("One-Click") })
  .meta({ id: "StudyReminderOneClickUnsubscribe" });

export const studyReminderPaths = {
  "/me/study-reminder": {
    get: {
      description:
        "One reminder a day, by email and by push to one phone, each on or off. Reading never saves anything.",
      operationId: "getCurrentUserStudyReminder",
      responses: { "200": reminderResponse, "401": unauthorizedResponse },
      security: AUTHENTICATED_SECURITY,
      summary: "Get current user's study reminder",
      tags: ["Account"],
    },
    patch: {
      description:
        "Send only the fields the learner changed, with the app's language. A language alone changes nothing until reminders are saved once.",
      operationId: "updateCurrentUserStudyReminder",
      requestBody: {
        content: { "application/json": { schema: studyReminderUpdateSchema } },
        required: true,
      },
      responses: {
        "200": reminderResponse,
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "422": {
          ...unprocessableEntityResponse,
          description: `A guest turned email on (${accessErrorCodes.accountRequired}), push was turned on with no phone selected (${accessErrorCodes.phoneRequired}), or the time isn't on a quarter hour (${accessErrorCodes.timeNotOnQuarterHour}).`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Update current user's study reminder",
      tags: ["Account"],
    },
  },
  "/me/study-reminder/offer": {
    post: {
      description:
        "Send when the offer after a plan lesson shows (`reminderOffer` in the block's completion). It's asked once per learner, so show it only when `claimed` is true.",
      operationId: "claimCurrentUserStudyReminderOffer",
      requestBody: {
        content: { "application/json": { schema: studyReminderOfferClaimSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: studyReminderOfferResultSchema } },
          description: "Whether this call marked the offer shown",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Claim the study reminder offer",
      tags: ["Account"],
    },
  },
  "/me/study-reminder/phone": {
    put: {
      description:
        "Makes this phone the one push goes to (Use this phone), or refreshes its token when it changes. The phone is bound to the calling session: signing out or session expiry disconnects it. Push stays as it was; turn it on with PATCH. Another account that had this device token loses it.",
      operationId: "selectCurrentUserStudyReminderPhone",
      requestBody: {
        content: { "application/json": { schema: studyReminderPhoneSchema } },
        required: true,
      },
      responses: {
        "200": reminderResponse,
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Select the phone for study reminders",
      tags: ["Account"],
    },
  },
  "/unsubscribe/study-reminders": {
    get: {
      description:
        "The reminder email's List-Unsubscribe link opened in a browser. Changes nothing: it redirects to Main's page, whose button turns email reminders off.",
      operationId: "openStudyReminderUnsubscribe",
      requestParams: { query: studyReminderUnsubscribeQuerySchema },
      responses: {
        "303": { description: "Main's unsubscribe page" },
        "400": validationErrorResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Open the study reminder unsubscribe page",
      tags: ["Account"],
    },
    post: {
      description:
        "RFC 8058 one-click unsubscribe from the mailbox: turns the token's account's email reminders off, and only that. Repeating it succeeds.",
      operationId: "unsubscribeStudyReminderEmail",
      requestBody: {
        content: { "application/x-www-form-urlencoded": { schema: oneClickBodySchema } },
      },
      requestParams: { query: studyReminderUnsubscribeQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: studyReminderUnsubscribeResponseSchema } },
          description: "Email reminders are off",
        },
        "400": {
          ...badRequestResponse,
          description: "The token isn't valid (INVALID_UNSUBSCRIBE_TOKEN), or it's missing.",
        },
      },
      security: PUBLIC_SECURITY,
      summary: "Unsubscribe from study reminder email",
      tags: ["Account"],
    },
  },
};

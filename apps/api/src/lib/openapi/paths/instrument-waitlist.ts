import { instrumentWaitlistJoinSchema } from "@zoonk/core/instrument-waitlist/contract";
import { accessErrorCodes } from "../../access-error-codes";
import {
  instrumentWaitlistEntryResponseSchema,
  instrumentWaitlistResponseSchema,
} from "../schemas/instrument-waitlist";
import { instrumentWaitlistEntryPathParamsSchema } from "../schemas/paths";
import {
  forbiddenResponse,
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const instrumentWaitlistPaths = {
  "/me/instrument-waitlist": {
    get: {
      description:
        "The instruments the learner is waiting to learn to play, oldest first. Lessons that teach playing need to hear the learner play, so until they exist onboarding offers musicianship as a learn goal and this waitlist.",
      operationId: "listInstrumentWaitlist",
      responses: {
        "200": {
          content: { "application/json": { schema: instrumentWaitlistResponseSchema } },
          description: "The learner's waitlist",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List the instrument waitlist",
      tags: ["Onboarding"],
    },
    post: {
      description:
        "Adds an instrument to the learner's waitlist, usually the `instrument` a goal understanding returned. Joining again with the same instrument, however it's written, returns the existing entry. Guests need an account first, since the waitlist is how learners hear when lessons are ready.",
      operationId: "joinInstrumentWaitlist",
      requestBody: {
        content: { "application/json": { schema: instrumentWaitlistJoinSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: instrumentWaitlistEntryResponseSchema } },
          description: "The learner's entry for this instrument",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "403": {
          ...forbiddenResponse,
          description: `Guests need an account. Error code: ${accessErrorCodes.accountRequired}.`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Join the instrument waitlist",
      tags: ["Onboarding"],
    },
  },
  "/me/instrument-waitlist/{entryId}": {
    delete: {
      description: "Takes one instrument off the learner's waitlist.",
      operationId: "leaveInstrumentWaitlist",
      requestParams: { path: instrumentWaitlistEntryPathParamsSchema },
      responses: {
        "204": { description: "Left the waitlist for this instrument" },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Leave the instrument waitlist",
      tags: ["Onboarding"],
    },
  },
};

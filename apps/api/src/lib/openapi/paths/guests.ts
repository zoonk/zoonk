import { accessErrorCodes } from "../../access-error-codes";
import { appProofHeaderParamsSchema } from "../schemas/app-attest";
import { guestSessionResponseSchema } from "../schemas/guests";
import { conflictResponse, forbiddenResponse } from "../schemas/responses";
import { PUBLIC_SECURITY } from "../security";
import { authRateLimitResponse } from "./sessions";

export const guestPaths = {
  "/guests": {
    post: {
      description:
        "A guest can take up to three lessons, at most one newly generated, start one goal and use a day's worth of small AI help, and all guests share one daily AI budget: once it's spent, a guest's new AI work answers 403 `SIGN_UP_REQUIRED` (ask them to create a free account to continue), while lessons already written and pictures already drawn stay free. Signing up or in later moves the guest's progress to that account, whose own caps apply from then on. Requests must pass Vercel BotID, which runs in a browser, or carry the iOS app's App Attest assertion in the `X-App-Attest-*` headers or the Android app's Play Integrity token in the `X-Play-Integrity-*` headers (see `POST /v1/app-attest/challenges`).",
      operationId: "createGuestSession",
      requestParams: { header: appProofHeaderParamsSchema },
      responses: {
        "201": {
          content: { "application/json": { schema: guestSessionResponseSchema } },
          description: "Guest bearer session created",
        },
        "403": {
          ...forbiddenResponse,
          description: `The request had no bot proof (BotID's, App Attest's or Play Integrity's). Error code: ${accessErrorCodes.botDetected}.`,
        },
        "409": {
          ...conflictResponse,
          description: `The session is already a guest. Error code: ${accessErrorCodes.alreadyGuest}.`,
        },
        "429": authRateLimitResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Create a guest session",
      tags: ["Sessions"],
    },
  },
};

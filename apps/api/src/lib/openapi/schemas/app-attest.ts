import {
  APP_ATTEST_HEADERS,
  appAttestHeadersSchema,
  appAttestKeyRequestSchema,
} from "@zoonk/auth/app-attest-contract";
import { z } from "zod";

export const appAttestChallengeResponseSchema = z
  .object({
    challenge: z
      .string()
      .min(1)
      .meta({
        description:
          "Single-use and valid for five minutes. An attestation's client data hash is the SHA-256 of its UTF-8 bytes; an assertion signs it inside the request's client data (see the `x-app-attest-assertion` header).",
      }),
  })
  .meta({ id: "AppAttestChallenge" });

export const appAttestKeyRequestBodySchema = appAttestKeyRequestSchema
  .extend({
    attestation: appAttestKeyRequestSchema.shape.attestation.meta({
      description: "Base64 of the attestation object `DCAppAttestService.attestKey` returned",
    }),
    challenge: appAttestKeyRequestSchema.shape.challenge.meta({
      description:
        "The challenge from `POST /v1/app-attest/challenges` the attestation was made over",
    }),
    keyId: appAttestKeyRequestSchema.shape.keyId.meta({
      description: "The key ID `DCAppAttestService.generateKey` returned",
    }),
  })
  .meta({ id: "AppAttestKeyRequest" });

/**
 * The optional App Attest proof the iOS app sends where a browser would carry BotID's: all three
 * headers, or none.
 */
export const appAttestHeaderParamsSchema = z.object({
  [APP_ATTEST_HEADERS.assertion]: appAttestHeadersSchema.shape[APP_ATTEST_HEADERS.assertion]
    .optional()
    .meta({
      description:
        "Base64 of the assertion `DCAppAttestService.generateAssertion` made over the SHA-256 of the request's client data: UTF-8 lines joined by a line feed, with `zoonk-app-attest:1`, the challenge, the operation (`guest` for POST /v1/guests, `email-code` for POST /v1/email-sign-in-codes, `email-session` for POST /v1/sessions/email-code), then the email and, for `email-session`, the code, exactly as sent in the body",
    }),
  [APP_ATTEST_HEADERS.challenge]: appAttestHeadersSchema.shape[APP_ATTEST_HEADERS.challenge]
    .optional()
    .meta({ description: "A fresh challenge from `POST /v1/app-attest/challenges`" }),
  [APP_ATTEST_HEADERS.keyId]: appAttestHeadersSchema.shape[APP_ATTEST_HEADERS.keyId]
    .optional()
    .meta({ description: "The key registered with `POST /v1/app-attest/keys`" }),
});

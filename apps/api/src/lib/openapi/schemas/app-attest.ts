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
          "Single-use and valid for five minutes. Hash its UTF-8 bytes with SHA-256 for the client data of the attestation or assertion it's for.",
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
        "Base64 of the assertion `DCAppAttestService.generateAssertion` made over the challenge",
    }),
  [APP_ATTEST_HEADERS.challenge]: appAttestHeadersSchema.shape[APP_ATTEST_HEADERS.challenge]
    .optional()
    .meta({ description: "A fresh challenge from `POST /v1/app-attest/challenges`" }),
  [APP_ATTEST_HEADERS.keyId]: appAttestHeadersSchema.shape[APP_ATTEST_HEADERS.keyId]
    .optional()
    .meta({ description: "The key registered with `POST /v1/app-attest/keys`" }),
});

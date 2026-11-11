import { appAttestKeyRequestSchema } from "@zoonk/auth/app-attest-contract";
import {
  PLAY_INTEGRITY_HEADERS,
  playIntegrityHeadersSchema,
} from "@zoonk/auth/play-integrity-contract";
import { z } from "zod";

export const appAttestChallengeResponseSchema = z
  .object({
    challenge: z
      .string()
      .min(1)
      .meta({
        description:
          "Single-use and valid for five minutes. An attestation's client data hash is the SHA-256 of its UTF-8 bytes; a Play Integrity token's request hash covers its request client data (see the `x-play-integrity-token` header). A restore key's WebAuthn request uses it as its `challenge`, unchanged.",
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

export const playIntegrityHeaderParamsSchema = z.object({
  [PLAY_INTEGRITY_HEADERS.challenge]: playIntegrityHeadersSchema.shape[
    PLAY_INTEGRITY_HEADERS.challenge
  ]
    .optional()
    .meta({ description: "A fresh challenge from `POST /v1/app-attest/challenges`" }),
  [PLAY_INTEGRITY_HEADERS.token]: playIntegrityHeadersSchema.shape[PLAY_INTEGRITY_HEADERS.token]
    .optional()
    .meta({
      description:
        "The token a Play Integrity standard request returned, with its request hash set to the unpadded base64url SHA-256 of UTF-8 lines joined by a line feed: `zoonk-app-attest:1`, the challenge, `restore-key`, then the registration's credential `id`",
    }),
});

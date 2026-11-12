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
          "Single-use and valid for five minutes. A Play Integrity token's request hash covers it (see the `x-play-integrity-token` header); a restore key's WebAuthn request uses it as its `challenge`, unchanged.",
      }),
  })
  .meta({ id: "AppAttestChallenge" });

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

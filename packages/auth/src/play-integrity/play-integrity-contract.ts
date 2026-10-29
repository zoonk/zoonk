import { z } from "zod";
import { appAttestChallengeSchema } from "../app-attest/app-attest-contract";

export const PLAY_INTEGRITY_HEADERS = {
  challenge: "x-play-integrity-challenge",
  token: "x-play-integrity-token",
} as const;

/** Google's encrypted tokens run a few kilobytes. */
const MAX_TOKEN_LENGTH = 16_384;

export const playIntegrityHeadersSchema = z.object({
  [PLAY_INTEGRITY_HEADERS.challenge]: appAttestChallengeSchema,
  [PLAY_INTEGRITY_HEADERS.token]: z.string().min(1).max(MAX_TOKEN_LENGTH),
});

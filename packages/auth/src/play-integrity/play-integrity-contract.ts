import { z } from "zod";

export const PLAY_INTEGRITY_HEADERS = {
  challenge: "x-play-integrity-challenge",
  token: "x-play-integrity-token",
} as const;

/** Google's encrypted tokens run a few kilobytes. */
const MAX_TOKEN_LENGTH = 16_384;
const MAX_CHALLENGE_LENGTH = 128;

export const playIntegrityHeadersSchema = z.object({
  [PLAY_INTEGRITY_HEADERS.challenge]: z.string().min(1).max(MAX_CHALLENGE_LENGTH),
  [PLAY_INTEGRITY_HEADERS.token]: z.string().min(1).max(MAX_TOKEN_LENGTH),
});

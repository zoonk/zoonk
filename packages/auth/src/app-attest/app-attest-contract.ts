import { z } from "zod";

/**
 * The headers that carry an App Attest assertion on requests that need bot proof. Native apps
 * can't run BotID, so a genuine copy of the iOS app proves itself with these instead.
 */
export const APP_ATTEST_HEADERS = {
  assertion: "x-app-attest-assertion",
  challenge: "x-app-attest-challenge",
  keyId: "x-app-attest-key-id",
} as const;

export const APP_ATTESTATION_INVALID_ERROR_CODE = "APP_ATTESTATION_INVALID";

/** Apple's key IDs are a base64 SHA-256 (44 characters); attestations run a few kilobytes. */
const MAX_KEY_ID_LENGTH = 64;
const MAX_ATTESTATION_LENGTH = 16_384;
const MAX_ASSERTION_LENGTH = 4096;
const MAX_CHALLENGE_LENGTH = 128;

const appAttestKeyIdSchema = z.base64().max(MAX_KEY_ID_LENGTH);
const appAttestChallengeSchema = z.string().min(1).max(MAX_CHALLENGE_LENGTH);

export const appAttestKeyRequestSchema = z
  .object({
    attestation: z.base64().max(MAX_ATTESTATION_LENGTH),
    challenge: appAttestChallengeSchema,
    keyId: appAttestKeyIdSchema,
  })
  .strict();

export const appAttestHeadersSchema = z.object({
  [APP_ATTEST_HEADERS.assertion]: z.base64().max(MAX_ASSERTION_LENGTH),
  [APP_ATTEST_HEADERS.challenge]: appAttestChallengeSchema,
  [APP_ATTEST_HEADERS.keyId]: appAttestKeyIdSchema,
});

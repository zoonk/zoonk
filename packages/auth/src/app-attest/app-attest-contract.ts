import { z } from "zod";

export const APP_ATTESTATION_INVALID_ERROR_CODE = "APP_ATTESTATION_INVALID";

export const APP_ATTEST_OPERATIONS = { restoreKey: "restore-key" } as const;

type AppAttestOperation = (typeof APP_ATTEST_OPERATIONS)[keyof typeof APP_ATTEST_OPERATIONS];

export type AppAttestBinding = { fields: string[]; operation: AppAttestOperation };

const APP_ATTEST_CLIENT_DATA_VERSION = "zoonk-app-attest:1";

/**
 * The Android app builds the same text for Play Integrity restore-key proofs. Fields never hold a
 * line break; the server refuses one.
 */
export function getAppAttestClientData({
  binding,
  challenge,
}: {
  binding: AppAttestBinding;
  challenge: string;
}): string {
  return [APP_ATTEST_CLIENT_DATA_VERSION, challenge, binding.operation, ...binding.fields].join(
    "\n",
  );
}

/** Apple's key IDs are a base64 SHA-256 (44 characters); attestations run a few kilobytes. */
const MAX_KEY_ID_LENGTH = 64;
const MAX_ATTESTATION_LENGTH = 16_384;
const MAX_CHALLENGE_LENGTH = 128;

const appAttestKeyIdSchema = z.base64().max(MAX_KEY_ID_LENGTH);
export const appAttestChallengeSchema = z.string().min(1).max(MAX_CHALLENGE_LENGTH);

export const appAttestKeyRequestSchema = z
  .object({
    attestation: z.base64().max(MAX_ATTESTATION_LENGTH),
    challenge: appAttestChallengeSchema,
    keyId: appAttestKeyIdSchema,
  })
  .strict();

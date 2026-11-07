import { z } from "zod";

/** The Android app creates and reads its restore keys for this RP ID, so changing it strands every key. */
export const RESTORE_KEY_RP_ID = "www.zoonk.com";

export const RESTORE_KEY_ERROR_CODES = {
  challengeInvalid: "RESTORE_KEY_CHALLENGE_INVALID",
  keyInvalid: "RESTORE_KEY_INVALID",
  registrationInvalid: "RESTORE_KEY_REGISTRATION_INVALID",
  responseMalformed: "RESTORE_KEY_RESPONSE_MALFORMED",
} as const;

/** A registration with an RS256 key and its attestation runs about a kilobyte. */
const MAX_RESPONSE_JSON_LENGTH = 16_384;

const responseJsonSchema = z.string().min(1).max(MAX_RESPONSE_JSON_LENGTH);

export const restoreKeyRequestSchema = z
  .object({ registrationResponseJson: responseJsonSchema })
  .strict();

export const restoreKeySessionRequestSchema = z
  .object({ authenticationResponseJson: responseJsonSchema })
  .strict();

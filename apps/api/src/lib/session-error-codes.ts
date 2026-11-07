import { APP_ATTESTATION_INVALID_ERROR_CODE } from "@zoonk/auth/app-attest-contract";
import { DISPOSABLE_EMAIL_ERROR_CODE } from "@zoonk/auth/email-signup-contract";
import { RESTORE_KEY_ERROR_CODES } from "@zoonk/auth/restore-key-contract";

export const sessionErrorCodes = {
  accountDisabled: "ACCOUNT_DISABLED",
  appAttestationInvalid: APP_ATTESTATION_INVALID_ERROR_CODE,
  appleAuthorizationInvalid: "APPLE_AUTHORIZATION_INVALID",
  disposableEmail: DISPOSABLE_EMAIL_ERROR_CODE,
  emailCodeExpired: "EMAIL_SIGN_IN_CODE_EXPIRED",
  emailCodeInvalid: "EMAIL_SIGN_IN_CODE_INVALID",
  emailCodeLocked: "EMAIL_SIGN_IN_CODE_LOCKED",
  googleAuthorizationInvalid: "GOOGLE_AUTHORIZATION_INVALID",
  rateLimitExceeded: "RATE_LIMIT_EXCEEDED",
  restoreKeyChallengeInvalid: RESTORE_KEY_ERROR_CODES.challengeInvalid,
  restoreKeyInvalid: RESTORE_KEY_ERROR_CODES.keyInvalid,
  restoreKeyRegistrationInvalid: RESTORE_KEY_ERROR_CODES.registrationInvalid,
  restoreKeyResponseMalformed: RESTORE_KEY_ERROR_CODES.responseMalformed,
} as const;

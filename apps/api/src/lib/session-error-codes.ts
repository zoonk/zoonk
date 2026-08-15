export const sessionErrorCodes = {
  accountDisabled: "ACCOUNT_DISABLED",
  appleAuthorizationInvalid: "APPLE_AUTHORIZATION_INVALID",
  emailCodeExpired: "EMAIL_SIGN_IN_CODE_EXPIRED",
  emailCodeInvalid: "EMAIL_SIGN_IN_CODE_INVALID",
  emailCodeLocked: "EMAIL_SIGN_IN_CODE_LOCKED",
  googleAuthorizationInvalid: "GOOGLE_AUTHORIZATION_INVALID",
  rateLimitExceeded: "RATE_LIMIT_EXCEEDED",
} as const;

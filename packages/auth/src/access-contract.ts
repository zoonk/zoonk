/**
 * Error codes shared by the auth hooks, core capabilities and the API, so clients can react to each
 * access rule (show a message, ask a guardian, sign out) without parsing messages.
 */
export const ACCESS_ERROR_CODES = {
  botDetected: "BOT_DETECTED",
  guardianApprovalRequired: "GUARDIAN_APPROVAL_REQUIRED",
  guestPurchaseNotAllowed: "GUEST_PURCHASE_NOT_ALLOWED",
  guestSignInLimitReached: "GUEST_SIGN_IN_LIMIT_REACHED",
  signUpLimitReached: "SIGN_UP_LIMIT_REACHED",
  underMinimumAge: "UNDER_MINIMUM_AGE",
} as const;

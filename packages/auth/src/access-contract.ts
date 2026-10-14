/**
 * Error codes shared by the auth hooks, core capabilities and the API, so clients can react to each
 * access rule (show a message, ask for an account, wait) without parsing messages.
 */
export const ACCESS_ERROR_CODES = {
  botDetected: "BOT_DETECTED",
  brandAddressLocked: "BRAND_ADDRESS_LOCKED",
  guestPurchaseNotAllowed: "GUEST_PURCHASE_NOT_ALLOWED",
  untrustedOrigin: "UNTRUSTED_ORIGIN",
} as const;

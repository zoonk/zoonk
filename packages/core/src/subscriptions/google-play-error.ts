export type GooglePlayErrorReason =
  | "accountMismatch"
  | "configuration"
  | "conflict"
  | "invalidProduct"
  | "invalidPurchase"
  | "unauthorized"
  | "unavailable";

export class GooglePlayError extends Error {
  readonly reason: GooglePlayErrorReason;

  constructor(reason: GooglePlayErrorReason, options?: ErrorOptions) {
    super(`Google Play error: ${reason}`, options);
    this.name = "GooglePlayError";
    this.reason = reason;
  }
}

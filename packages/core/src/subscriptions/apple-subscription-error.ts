export type AppleSubscriptionErrorReason =
  | "accountMismatch"
  | "configuration"
  | "conflict"
  | "invalidProduct"
  | "invalidTransaction"
  | "unauthorized"
  | "unavailable";

export class AppleSubscriptionError extends Error {
  readonly reason: AppleSubscriptionErrorReason;

  constructor(reason: AppleSubscriptionErrorReason, options?: ErrorOptions) {
    super(`Apple subscription error: ${reason}`, options);
    this.name = "AppleSubscriptionError";
    this.reason = reason;
  }
}

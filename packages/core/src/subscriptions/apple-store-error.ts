export type AppleStoreErrorReason = "configuration" | "invalidTransaction" | "unavailable";

export class AppleStoreError extends Error {
  readonly reason: AppleStoreErrorReason;

  constructor(reason: AppleStoreErrorReason, options?: ErrorOptions) {
    super(`Apple Store error: ${reason}`, options);
    this.name = "AppleStoreError";
    this.reason = reason;
  }
}

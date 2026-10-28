export class RetryableError extends Error {
  retryAfter: unknown;

  constructor(message?: string, options?: { retryAfter?: unknown }) {
    super(message);
    this.name = "RetryableError";
    this.retryAfter = options?.retryAfter;
  }
}

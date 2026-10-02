/** Steps throw it to be retried after a delay, such as after a provider's rate limit. */
export class RetryableError extends Error {
  retryAfter: unknown;

  constructor(message?: string, options?: { retryAfter?: unknown }) {
    super(message);
    this.name = "RetryableError";
    this.retryAfter = options?.retryAfter;
  }
}

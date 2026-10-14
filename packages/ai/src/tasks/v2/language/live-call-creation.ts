/** The adapter stops waiting for a creation request after this. */
export const LIVE_CALL_CREATE_TIMEOUT_MS = 30_000;

/**
 * OpenAI refused the creation request with its own error. Its Live docs say a session whose
 * creation failed over HTTP never reaches `session.started`, so at most initialization was billed.
 */
export class LiveCallCreationRefusedError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, options?: ErrorOptions) {
    super(`The provider refused to create a Live session (${statusCode})`, options);
    this.name = "LiveCallCreationRefusedError";
    this.statusCode = statusCode;
  }
}

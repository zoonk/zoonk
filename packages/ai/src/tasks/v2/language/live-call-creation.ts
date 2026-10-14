/** The adapter aborts a creation request after this, so no provider ID can arrive later. */
export const LIVE_CALL_CREATE_TIMEOUT_MS = 30_000;

/** The provider answered with a status proving it created no session: nothing can bill for it. */
export class LiveCallCreationRefusedError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, options?: ErrorOptions) {
    super(`The provider refused to create a Live session (${statusCode})`, options);
    this.name = "LiveCallCreationRefusedError";
    this.statusCode = statusCode;
  }
}

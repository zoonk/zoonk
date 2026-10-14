/** The adapter stops waiting for a creation request after this. */
export const LIVE_CALL_CREATE_TIMEOUT_MS = 30_000;

/**
 * An operational estimate, not a guarantee, of how long a Live WebRTC session runs before OpenAI
 * ends it as `expired`: OpenAI publishes no number for this route (each session carries
 * `expires_at`). It caps connected Live SIP calls at 2 hours
 * (https://developers.openai.com/api/docs/guides/voice-sip?api=live#handle-limits-and-errors)
 * and Realtime sessions at 60 minutes
 * (https://developers.openai.com/api/docs/guides/realtime-conversations#session-lifecycle-events).
 * A late receipt or confirmed close still replaces an estimate settled from it, once.
 */
export const LIVE_SESSION_ESTIMATED_MAX_SECONDS = 2 * 60 * 60;

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

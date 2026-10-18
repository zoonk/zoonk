import "server-only";
import { APICallError } from "ai";
import { type LiveCallSessionClosed } from "./_utils/live-call-closed-event";
import { getLiveCallModel } from "./_utils/live-call-provider";
import { closeLiveCallSideband } from "./_utils/live-call-sideband";
import { LIVE_CALL_CREATE_TIMEOUT_MS, LiveCallCreationRefusedError } from "./live-call-creation";

const CLOSE_TIMEOUT_MS = 15_000;

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const CONTENT_TOO_LARGE = 413;
const UNSUPPORTED_MEDIA_TYPE = 415;
const UNPROCESSABLE_CONTENT = 422;
const TOO_MANY_REQUESTS = 429;

/**
 * Refusals of the request itself: a bad request, credentials, a missing model, an oversized or
 * unreadable body, or a rate limit. Timeouts, conflicts, server errors, dropped connections and
 * unreadable successes stay ambiguous, since a session may exist that we can't name.
 */
const NO_SESSION_STATUSES = new Set<number>([
  BAD_REQUEST,
  UNAUTHORIZED,
  FORBIDDEN,
  NOT_FOUND,
  CONTENT_TOO_LARGE,
  UNSUPPORTED_MEDIA_TYPE,
  UNPROCESSABLE_CONTENT,
  TOO_MANY_REQUESTS,
]);

/** Only OpenAI's own error body counts: a proxy's page or an empty body proves nothing. */
function toCreationError(error: unknown): unknown {
  if (
    APICallError.isInstance(error) &&
    error.data !== undefined &&
    error.statusCode !== undefined &&
    NO_SESSION_STATUSES.has(error.statusCode)
  ) {
    return new LiveCallCreationRefusedError(error.statusCode, { cause: error });
  }

  return error;
}

export type { LiveCallSessionClosed } from "./_utils/live-call-closed-event";
export { isLiveCallAvailable } from "./_utils/live-call-provider";

export type LiveCallSession = { sdp: string; sessionId: string };

/**
 * Callers authorize and fence the reservation; browser configuration never enters this boundary.
 * Rejects with `LiveCallCreationRefusedError` only when OpenAI itself refused the request.
 */
export async function createLiveCallSession({
  instructions,
  sdp,
  voice,
}: {
  instructions: string;
  sdp: string;
  voice: string;
}): Promise<LiveCallSession> {
  const created = getLiveCallModel().doCreateWebRTCSession({
    abortSignal: AbortSignal.timeout(LIVE_CALL_CREATE_TIMEOUT_MS),
    sdp,
    sessionConfig: {
      instructions,
      providerOptions: {
        openai: {
          client: {
            dataChannel: {
              allowedClientEvents: [
                "session.close",
                "session.thinking.append",
                "session.instructions.append",
                "session.input_audio.mute",
                "session.input_audio.unmute",
              ],
              allowedServerEvents: [
                { type: "session.started" },
                { type: "session.closed" },
                { type: "session.usage.updated" },
                { type: "session.input_transcript.delta" },
                { type: "session.output_transcript.delta" },
                { type: "session.delegation.created" },
                { type: "session.thinking.appended" },
                { type: "session.instructions.appended" },
                { type: "session.input_audio.muted" },
                { type: "session.input_audio.unmuted" },
                { type: "error" },
              ],
            },
          },
          delegation: { type: "client" },
          store: false,
        },
      },
      voice,
    },
  });

  return created.catch((error: unknown) => {
    throw toCreationError(error);
  });
}

/** Only a server-observed terminal receipt permits core to release the slot and settle usage. */
export async function closeLiveCallSession(
  providerSessionId: string,
): Promise<LiveCallSessionClosed> {
  const deadlineAt = Date.now() + CLOSE_TIMEOUT_MS;
  const { headers, url } = getLiveCallModel().getServerWebSocketConfig();

  return closeLiveCallSideband({ deadlineAt, headers, providerSessionId, url });
}

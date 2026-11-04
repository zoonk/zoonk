import "server-only";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { APICallError } from "ai";
import { getLiveCallModel, liveCallFetch } from "./_utils/live-call-provider";
import { type LiveCallTurn, getLiveCallStartupInput } from "./_utils/live-call-startup-input";
import { LIVE_CALL_CREATE_TIMEOUT_MS, LiveCallCreationRefusedError } from "./live-call-creation";

/** OpenAI answers a hangup within a second; one for a session that already ended took 6 s. */
const HANGUP_TIMEOUT_MS = 15_000;

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const CONTENT_TOO_LARGE = 413;
const UNSUPPORTED_MEDIA_TYPE = 415;
const UNPROCESSABLE_CONTENT = 422;
const TOO_MANY_REQUESTS = 429;

/**
 * Refusals of the request itself. Timeouts, conflicts, server errors and dropped connections stay
 * ambiguous, since a session may exist that we can't name.
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

export { isLiveCallAvailable } from "./_utils/live-call-provider";

export type LiveCallSession = { sdp: string; sessionId: string };

/**
 * Callers authorize and fence the reservation; browser configuration never enters this boundary.
 * Rejects with `LiveCallCreationRefusedError` only when OpenAI itself refused the request.
 * `greeting` starts the session as developer input, so the character can speak first as soon as the
 * app's commentary cue arrives. `turns`, the call so far, come before it only as the learner's and
 * the character's own messages, never as instructions.
 */
export async function createLiveCallSession({
  greeting,
  instructions,
  sdp,
  turns,
  voice,
}: {
  greeting: string;
  instructions: string;
  sdp: string;
  turns: readonly LiveCallTurn[];
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
                "session.commentary.append",
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
                { type: "session.commentary.appended" },
                { type: "session.thinking.appended" },
                { type: "session.instructions.appended" },
                { type: "session.input_audio.muted" },
                { type: "session.input_audio.unmuted" },
                { type: "error" },
              ],
            },
          },
          delegation: { type: "client" },
          input: getLiveCallStartupInput({ greeting, turns }),
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

/** OpenAI's answer for a session that doesn't exist anymore: it already ended. */
async function isAlreadyEnded(response: Response): Promise<boolean> {
  if (response.status !== NOT_FOUND) {
    return false;
  }

  const body: unknown = await response.json().catch(() => null);
  const error = isJsonObject(body) ? body.error : null;

  return getString(error, "code") === "session_id_not_found";
}

export type LiveCallHangup = "alreadyEnded" | "hungUp";

/**
 * Resolves once the session is over, saying whether it already was; rejects with the provider's
 * status and body when its answer doesn't say.
 */
export async function hangUpLiveCallSession(providerSessionId: string): Promise<LiveCallHangup> {
  // The SDK has no hangup helper: the session's REST path sits beside its WebSocket one.
  const { headers, url } = await getLiveCallModel().getServerWebSocketConfig();
  const endpoint = new URL(`${url}/${encodeURIComponent(providerSessionId)}/hangup`);
  endpoint.protocol = endpoint.protocol === "ws:" ? "http:" : "https:";

  const response = await liveCallFetch(endpoint, {
    headers,
    method: "POST",
    signal: AbortSignal.timeout(HANGUP_TIMEOUT_MS),
  });

  if (response.ok) {
    return "hungUp";
  }

  if (await isAlreadyEnded(response.clone())) {
    return "alreadyEnded";
  }

  const body = await response.text().catch(() => "");
  throw new Error(`The provider didn't hang up the Live session (${response.status}): ${body}`);
}

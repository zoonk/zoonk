import "server-only";
import { type LiveCallSessionClosed } from "./_utils/live-call-closed-event";
import { getLiveCallModel } from "./_utils/live-call-provider";
import { closeLiveCallSideband } from "./_utils/live-call-sideband";

const CREATE_TIMEOUT_MS = 30_000;
const CLOSE_TIMEOUT_MS = 15_000;

export type { LiveCallSessionClosed } from "./_utils/live-call-closed-event";
export { isLiveCallAvailable } from "./_utils/live-call-provider";

export type LiveCallSession = { sdp: string; sessionId: string };

/** Callers authorize and fence the reservation; browser configuration never enters this boundary. */
export async function createLiveCallSession({
  instructions,
  sdp,
  voice,
}: {
  instructions: string;
  sdp: string;
  voice: string;
}): Promise<LiveCallSession> {
  return getLiveCallModel().doCreateWebRTCSession({
    abortSignal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
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
}

/** Only a server-observed terminal receipt permits core to release the slot and settle usage. */
export async function closeLiveCallSession(
  providerSessionId: string,
): Promise<LiveCallSessionClosed> {
  const deadlineAt = Date.now() + CLOSE_TIMEOUT_MS;
  const { headers, url } = getLiveCallModel().getServerWebSocketConfig();

  return closeLiveCallSideband({ deadlineAt, headers, providerSessionId, url });
}

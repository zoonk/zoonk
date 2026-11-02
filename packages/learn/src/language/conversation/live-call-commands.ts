import { type LiveCallSession } from "./live-call-session";

/** A cue sent while the call is closing is dropped. */
export function sendLiveCallCue({
  channel = "instructions",
  content,
  delegationId = null,
  session,
}: {
  channel?: "instructions" | "thinking";
  content: string;
  delegationId?: string | null;
  session: LiveCallSession;
}) {
  try {
    void session
      .sendEvent({
        content,
        delegationId,
        providerOptions: { openai: { channel } },
        type: "context-append",
      })
      .catch(() => null);
  } catch {
    // The session stopped accepting cues: the call is ending.
  }
}

export function setLiveCallMuted({ muted, session }: { muted: boolean; session: LiveCallSession }) {
  try {
    void session
      .sendEvent({ type: muted ? "input-audio-mute" : "input-audio-unmute" })
      .catch(() => null);
  } catch {
    // The session stopped accepting commands: the call is ending.
  }
}

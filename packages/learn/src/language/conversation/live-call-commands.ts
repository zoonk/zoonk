import { type LiveCallCue } from "./live-call-script";
import { type LiveCallSession } from "./live-call-session";

/** False when the session no longer takes cues, as when its connection was just lost. */
export function sendLiveCallCue({
  cue,
  delegationId = null,
  eventId,
  session,
}: {
  cue: LiveCallCue;
  delegationId?: string | null;
  eventId?: string;
  session: LiveCallSession;
}): boolean {
  try {
    void session
      .sendEvent({
        content: cue.text,
        delegationId,
        eventId,
        providerOptions: { openai: { channel: cue.channel } },
        type: "context-append",
      })
      .catch(() => null);

    return true;
  } catch {
    return false;
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

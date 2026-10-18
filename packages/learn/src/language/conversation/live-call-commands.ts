import { type LiveCallSession } from "./live-call-session";

/**
 * Tells GPT-Live something during the call. `instructions` makes it act now; `thinking` only adds
 * context. A cue that can't be delivered, because the call is closing, is dropped.
 */
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

/**
 * Mutes or unmutes the learner's microphone in the call. GPT-Live keeps listening for the audio
 * stream but ignores it while muted; a call that's closing ignores the change.
 */
export function setLiveCallMuted({ muted, session }: { muted: boolean; session: LiveCallSession }) {
  try {
    void session
      .sendEvent({ type: muted ? "input-audio-mute" : "input-audio-unmute" })
      .catch(() => null);
  } catch {
    // The session stopped accepting commands: the call is ending.
  }
}

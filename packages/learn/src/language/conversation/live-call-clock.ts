import { type LanguageConversationSetup } from "@zoonk/core/language/conversations/contract";
import { type LiveCallScript } from "./live-call-script";

const MS_PER_SECOND = 1000;

/**
 * On this device's clock, from when the server's answer arrived: the time it said was left, so a
 * device whose clock is off still ends on time. `clockFrom` is when a continued call's talk time
 * began; a new call's begins as it goes live.
 */
export type CallLength = {
  clockFrom: number | null;
  hardStopAt: number;
  script: LiveCallScript;
  talkEndsAt: number;
};

export type TimedCue = { atSeconds: number; say: string };

/** A call's whole talk time is `minutes`, so a continued call has used what its window lost. */
export function getCallLength({
  answeredAt,
  callSeconds,
  setup,
}: {
  answeredAt: number;
  callSeconds: number;
  setup: Pick<LanguageConversationSetup, "continuesCall" | "script" | "seconds" | "talkSeconds">;
}): CallLength {
  return {
    clockFrom: setup.continuesCall
      ? answeredAt - (callSeconds - setup.talkSeconds) * MS_PER_SECOND
      : null,
    hardStopAt: answeredAt + setup.seconds * MS_PER_SECOND,
    script: setup.script,
    talkEndsAt: answeredAt + setup.talkSeconds * MS_PER_SECOND,
  };
}

/** Of the cues due and not sent, only the latest goes: the ones a drop skipped are past. */
export function takeDueExamCue({
  cues,
  elapsedSeconds,
  sent,
}: {
  cues: readonly TimedCue[];
  elapsedSeconds: number;
  sent: number;
}): { cue: TimedCue; sent: number } | null {
  const due = cues.findLastIndex((cue, index) => index >= sent && cue.atSeconds <= elapsedSeconds);
  const cue = cues[due];

  return cue ? { cue, sent: due + 1 } : null;
}

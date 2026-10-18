import { createHash } from "node:crypto";
import { normalizeSpeechText } from "../../audio/speech-clip-contract";
import { type ListeningContent } from "./listening-content";

const SCRIPT_HASH_LENGTH = 32;

/**
 * The reuse key of a voiced recording: its language and a hash of what is heard, each turn with
 * the voice and accent that say it. Every set with the same script plays the same file, and
 * changing the voices' instructions later voices new scripts only: re-voicing stored recordings
 * is a person's call, never a deploy's.
 */
export function getListeningAudioKey(content: ListeningContent): string {
  const speakers = new Map(content.script.speakers.map((speaker) => [speaker.key, speaker]));

  const heard = content.script.turns.map((turn) => {
    const speaker = speakers.get(turn.speaker);
    return [speaker?.voice ?? "", speaker?.accent ?? "", normalizeSpeechText(turn.text)];
  });

  const scriptHash = createHash("sha256")
    .update(JSON.stringify(heard))
    .digest("hex")
    .slice(0, SCRIPT_HASH_LENGTH);

  return `listening:${content.scriptLanguage}:${scriptHash}`;
}

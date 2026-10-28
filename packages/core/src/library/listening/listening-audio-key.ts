import { createHash } from "node:crypto";
import { normalizeSpeechText } from "../../audio/speech-clip-contract";
import { type ListeningContent } from "./listening-content";

const SCRIPT_HASH_LENGTH = 32;

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

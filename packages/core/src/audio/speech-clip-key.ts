import { createHash } from "node:crypto";
import { getLanguageAudioPrompt } from "@zoonk/ai/tasks/audio/prompt";
import { normalizeSpeechText } from "./speech-clip-contract";

const TEXT_HASH_LENGTH = 32;

/**
 * The reuse key of a spoken clip: its language, the voice and instructions it's read with (their
 * prompt version, so changing either makes new clips instead of mixing voices) and a hash of the
 * normalized text. Every learner who hears the same words in the same language gets the same file.
 */
export function getSpeechClipKey({ language, text }: { language: string; text: string }): string {
  const { promptVersion } = getLanguageAudioPrompt({ language });

  const textHash = createHash("sha256")
    .update(normalizeSpeechText(text))
    .digest("hex")
    .slice(0, TEXT_HASH_LENGTH);

  return `audio:${language}:${promptVersion}:${textHash}`;
}

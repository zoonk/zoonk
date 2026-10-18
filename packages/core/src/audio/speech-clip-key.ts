import { createHash } from "node:crypto";
import { normalizeSpeechText } from "./speech-clip-contract";

const TEXT_HASH_LENGTH = 32;

/**
 * The reuse key of a spoken clip: its language and a hash of the normalized text. Every learner who
 * hears the same words in the same language gets the same file, whatever voice or instructions
 * read it: changing them voices new words only, and re-voicing stored clips is a person's call.
 * A learner's own words (`ownerId`) make a key of theirs alone.
 */
export function getSpeechClipKey({
  language,
  ownerId = null,
  text,
}: {
  language: string;
  ownerId?: string | null;
  text: string;
}): string {
  const textHash = createHash("sha256")
    .update(normalizeSpeechText(text))
    .digest("hex")
    .slice(0, TEXT_HASH_LENGTH);

  const key = `audio:${language}:${textHash}`;

  return ownerId ? `${key}:${ownerId}` : key;
}

import { createHash } from "node:crypto";
import { normalizeSpeechText } from "./speech-clip-contract";

const TEXT_HASH_LENGTH = 32;

/** Voice changes apply only to new clips; re-voicing stored clips requires an explicit decision. */
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

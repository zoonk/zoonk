import { createHash } from "node:crypto";

const PROMPT_HASH_LENGTH = 12;

/** A manual version, for changes the prompt doesn't show (an output schema), prefixes the hash. */
export function getPromptVersion({
  systemPrompt,
  version,
}: {
  systemPrompt: string;
  version?: string;
}): string {
  const hash = createHash("sha256").update(systemPrompt).digest("hex").slice(0, PROMPT_HASH_LENGTH);

  return version ? `${version}-${hash}` : hash;
}

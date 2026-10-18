import { createHash } from "node:crypto";

const PROMPT_HASH_LENGTH = 12;

/**
 * Identifies the exact instructions a generation ran with, so stored content
 * and analytics can be grouped by prompt revision without anyone remembering
 * to bump a number. A task can still declare a manual version for changes the
 * prompt text doesn't show (an output schema or pipeline change); it prefixes
 * the hash so both stay visible.
 */
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

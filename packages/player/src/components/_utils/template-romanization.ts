/**
 * Builds the template romanization for display by replacing the answer's
 * romanization with "____" so learners see a blank in both scripts.
 * Uses word-boundary matching so short romanizations like "o" (を) don't
 * accidentally match inside longer words like "okane" (お金).
 */
export function getTemplateRomanization({
  answer,
  sentence,
}: {
  answer?: string | null;
  sentence?: string | null;
}): string | null {
  if (!sentence) {
    return null;
  }

  if (!answer) {
    return sentence;
  }

  const escaped = answer.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const wordBoundaryPattern = new RegExp(`(?<=\\s|^)${escaped}(?=\\s|[.,!?;:]|$)`);

  return sentence.replace(wordBoundaryPattern, "____");
}

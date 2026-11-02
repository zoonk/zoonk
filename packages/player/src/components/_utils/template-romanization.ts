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

  const escaped = answer.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

  const wordBoundaryPattern = new RegExp(
    `(?<=\\s|^|["'«「])${escaped}(?=\\s|[.,!?;:)"'»」]|$)`,
    "iu",
  );

  return sentence.replace(wordBoundaryPattern, "____");
}

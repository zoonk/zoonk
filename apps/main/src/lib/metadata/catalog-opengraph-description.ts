const MAX_DESCRIPTION_LENGTH = 112;

export function getCatalogImageDescription({
  description,
  language,
}: {
  description?: string | null;
  language: string;
}): string {
  if (!description?.trim()) {
    return "";
  }

  const segmenter = new Intl.Segmenter(language, { granularity: "sentence" });
  const first = segmenter.segment(description.trim()).containing(0)?.segment.trim();

  return first && first.length <= MAX_DESCRIPTION_LENGTH ? first : "";
}

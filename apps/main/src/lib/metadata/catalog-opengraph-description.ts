const MAX_DESCRIPTION_LENGTH = 180;

export function truncateCatalogImageText({
  language,
  maxLength,
  text,
}: {
  language: string;
  maxLength: number;
  text: string;
}): string {
  const value = text.trim();

  if (value.length <= maxLength) {
    return value;
  }

  const limit = maxLength - 1;
  const words = new Intl.Segmenter(language, { granularity: "word" });
  const wordStart = words.segment(value).containing(limit)?.index;
  const prefix = value.slice(0, wordStart || limit).replace(/[\s\p{P}]+$/u, "");

  return `${prefix}…`;
}

export function getCatalogImageDescription({
  description,
  language,
}: {
  description?: string | null;
  language: string;
}): string {
  return truncateCatalogImageText({
    language,
    maxLength: MAX_DESCRIPTION_LENGTH,
    text: description ?? "",
  });
}

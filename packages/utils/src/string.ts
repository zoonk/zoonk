import slug from "slug";

export const SLUG_MAX_LENGTH = 50;
const NAME_PLACEHOLDER = "{{NAME}}";

export function removeAccents(str: string): string {
  return str.normalize("NFD").replaceAll(/[\u0300-\u036F]/g, "");
}

export function normalizeString(str: string): string {
  return removeAccents(str).toLowerCase().replaceAll(/\s+/g, " ").trim();
}

export function toSlug(str: string): string {
  return slug(str.trim());
}

export function emptyToNull(value?: string | null): string | null {
  return value?.trim() || null;
}

export function ensureLocaleSuffix(value: string, language: string): string {
  if (language === "en") {
    return value;
  }

  const suffix = `-${language}`;

  if (value.endsWith(suffix)) {
    return value;
  }

  return `${value}${suffix}`;
}

export function removeLocaleSuffix(value: string, language: string): string {
  if (language === "en") {
    return value;
  }

  const suffix = `-${language}`;

  return value.endsWith(suffix) ? value.slice(0, -suffix.length) : value;
}

export function stripPunctuation(text: string): string {
  return text.replaceAll(/[^\p{L}\p{N}\s]/gu, "");
}

/**
 * Segments text into words, handling both space-delimited languages (English, Spanish)
 * and non-space-delimited languages (Japanese, Chinese, Thai) via Intl.Segmenter.
 */
export function segmentWords(text: string): string[] {
  if (text.includes(" ")) {
    return text.split(" ");
  }

  const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });

  return [...segmenter.segment(text)]
    .filter((segment) => segment.isWordLike)
    .map((segment) => segment.segment);
}

export function extractUniqueSentenceWords(sentences: string[]): string[] {
  const words = sentences.flatMap((sentence) =>
    segmentWords(sentence)
      .map((token) => stripPunctuation(token).toLowerCase())
      .filter((token) => token.length > 0),
  );

  return [...new Set(words)];
}

export function replaceNamePlaceholder(text: string, name: string | null): string {
  if (!text.includes(NAME_PLACEHOLDER)) {
    return text;
  }

  if (name) {
    return text.replaceAll(NAME_PLACEHOLDER, name);
  }

  return text
    .replaceAll(/\{\{NAME\}\},\s*/g, "")
    .replaceAll(/,\s*\{\{NAME\}\}/g, "")
    .replaceAll(NAME_PLACEHOLDER, "")
    .trim();
}

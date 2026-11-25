const ILLEGIBLE = /\[illegible\]/giu;

/** What's left of a line once its markers are gone: a heading's `#`, a bullet or a list number. */
const MARKUP_ONLY = /^\s*(?:#{1,6}|[-*+]|\d+[.)])?\s*$/u;

/**
 * A model that can read nothing sometimes writes a skeleton of `[illegible]` lines instead of an
 * empty page; its list numbers would make a page with nothing on it look readable.
 */
export function toMaterialTranscript(text: string): string {
  const trimmed = text.trim();

  const isSkeleton = trimmed
    .replaceAll(ILLEGIBLE, "")
    .split("\n")
    .every((line) => MARKUP_ONLY.test(line));

  return isSkeleton ? "" : trimmed;
}

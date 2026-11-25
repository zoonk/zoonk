const ILLEGIBLE = /\[illegible\]/giu;

/** A line's leading marker: a heading's `#`, a bullet or a list number. */
const LINE_MARKER = /^\s*(?:#{1,6}|[-*+]|\d+[.)])\s*/u;

const WORD_CHARACTER = /[\p{L}\p{N}]/u;

/**
 * A page the model calls unreadable has no text, whatever note it left in `text`. A model that can
 * read nothing also sometimes writes a skeleton of `[illegible]` lines instead of an empty page;
 * its list numbers would make a page with nothing on it look readable.
 */
export function toMaterialTranscript({ readable, text }: { readable: boolean; text: string }) {
  const trimmed = text.trim();

  const isSkeleton = trimmed
    .replaceAll(ILLEGIBLE, "")
    .split("\n")
    .every((line) => !WORD_CHARACTER.test(line.replace(LINE_MARKER, "")));

  return readable && !isSkeleton ? trimmed : "";
}

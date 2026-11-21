import {
  type MaterialSource,
  formatMaterialOverview,
  toSourcePages,
} from "../../library/sources/material-pages";

/** How much of the learner's material the goal's reading sees, shared by every file. */
export const READING_MATERIAL_CHARACTERS = 6000;

/**
 * Each source gets an even share, so a long file can't crowd out a short note; one longer than its
 * share is read as the first line of each page or section. Null without any text to read.
 */
export function formatReadingMaterial({
  maxCharacters = READING_MATERIAL_CHARACTERS,
  sources,
}: {
  maxCharacters?: number;
  sources: readonly MaterialSource[];
}): string | null {
  const share = Math.floor(maxCharacters / Math.max(1, sources.length));

  const overviews = sources
    .map((source, index) =>
      formatMaterialOverview({ maxCharacters: share, pages: toSourcePages({ index, source }) }),
    )
    .filter(Boolean);

  return overviews.length > 0 ? overviews.join("\n") : null;
}

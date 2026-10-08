import { formatUntrustedInput } from "../../evaluate/untrusted-input";

/**
 * The documents a lesson is planned and written from, as data: `MATERIAL` for the learner's own
 * class material (a private lesson teaches from its pages) and `SOURCES` for the public documents
 * a shared lesson's facts come from (a law, an exam notice). Both come tagged page by page, so a
 * model can match facts to them; neither is ever read as instructions. Empty when there are none.
 */
export function formatLessonDocuments({
  material,
  sources,
}: {
  material?: string;
  sources?: string;
}): string {
  const documents = Object.fromEntries(
    [
      ["MATERIAL", material],
      ["SOURCES", sources],
    ].filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  return Object.keys(documents).length > 0 ? `\n${formatUntrustedInput(documents)}\n` : "";
}

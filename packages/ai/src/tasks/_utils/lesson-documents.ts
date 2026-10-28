import { formatUntrustedInput } from "../../evaluate/untrusted-input";

/** Tagged page by page, so a model can match facts to them; never read as instructions. */
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

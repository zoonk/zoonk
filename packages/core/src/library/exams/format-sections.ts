import { normalizeString } from "@zoonk/utils/string";

/** Drops a name the exam's list doesn't have and takes the list's spelling. */
export function keepExamParts({
  parts,
  sections,
}: {
  parts: readonly string[];
  sections: readonly string[];
}): string[] {
  const kept = sections.flatMap(
    (name) => parts.find((part) => normalizeString(part) === normalizeString(name)) ?? [],
  );

  return [...new Set(kept)];
}

/** A format tied to no part is asked in every part. */
export function isAskedIn({
  format,
  parts,
}: {
  format: { sections?: readonly string[] };
  parts: readonly string[];
}): boolean {
  return !format.sections?.length || keepExamParts({ parts, sections: format.sections }).length > 0;
}

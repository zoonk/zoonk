import { decodeHtmlEntities } from "../../_utils/html-entities";

const MAX_PART_NAME_LENGTH = 80;

/** The part of a focused area the learner named, with the area's skills in it. */
export type FocusPart = { area: string; name: string; skillIds: string[] };

/** A part's name as a label: trimmed, short, starting with a capital ("Biologia e química"). */
export function toPartName(value: string): string {
  const name = decodeHtmlEntities(value).trim().slice(0, MAX_PART_NAME_LENGTH);
  return name.charAt(0).toLocaleUpperCase() + name.slice(1);
}

/**
 * One part per area, because a plan keeps one: a model that names "biologia" and "química" as two
 * parts of the same area gets them joined into "Biologia e Química" with both parts' skills.
 */
export function joinPartsByArea({
  language = "en",
  parts,
}: {
  language?: string;
  parts: readonly FocusPart[];
}): FocusPart[] {
  const names = new Intl.ListFormat(language, { type: "conjunction" });

  return [...new Set(parts.map((part) => part.area))].map((area) => {
    const ofArea = parts.filter((part) => part.area === area);

    return {
      area,
      name: toPartName(names.format(ofArea.map((part) => part.name))),
      skillIds: [...new Set(ofArea.flatMap((part) => part.skillIds))],
    };
  });
}

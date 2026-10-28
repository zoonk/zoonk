import { decodeHtmlEntities } from "../../_utils/html-entities";

const MAX_PART_NAME_LENGTH = 80;

export type FocusPart = { area: string; name: string; skillIds: string[] };

export function toPartName(value: string): string {
  const name = decodeHtmlEntities(value).trim().slice(0, MAX_PART_NAME_LENGTH);
  return name.charAt(0).toLocaleUpperCase() + name.slice(1);
}

/**
 * A plan keeps one part per area, so "biology" and "chemistry" in one area join into "Biology and
 * Chemistry" with both parts' skills.
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

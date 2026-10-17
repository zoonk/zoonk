import { findNamingSections } from "../_utils/name-match";
import { type MockCandidate } from "./mock-plan";

/** Each question area's sections, by name: the sections that ask it (see `findNamingSections`). */
export type AreaSections = ReadonlyMap<string, readonly string[]>;

type NamedSection = { name: string | null };

/**
 * Which sections ask each question's area, when the areas line up with the exam's sections: some
 * question's area is named by a section, even in part (ENEM's "Natural Sciences and Mathematics"
 * names "Mathematics and its Technologies"), and an option counted inside another subject is asked
 * in that subject's sections (`partOf`: ENEM's foreign language in Languages'). Null when none is
 * (a goal without areas, or sections that don't name areas): sections can't be told apart by area.
 */
export function mapAreasToSections({
  allSections,
  candidates,
  partOf = new Map(),
}: {
  allSections: readonly NamedSection[];
  candidates: readonly MockCandidate[];
  partOf?: ReadonlyMap<string, string>;
}): AreaSections | null {
  const sections = allSections.flatMap((section) => (section.name ? [section.name] : []));
  const areas = new Set(candidates.flatMap((candidate) => candidate.area ?? []));

  const sectionsOf = (area: string) => {
    const named = findNamingSections({ name: area, sections });
    const whole = partOf.get(area);
    return named.length === 0 && whole ? findNamingSections({ name: whole, sections }) : named;
  };

  const mapped = new Map([...areas].map((area) => [area, sectionsOf(area)] as const));

  return [...mapped.values()].some((named) => named.length > 0) ? mapped : null;
}

/** Whether a question's area is one this section asks (see `mapAreasToSections`). */
export function isSectionArea({
  areaSections,
  candidate,
  section,
}: {
  areaSections: AreaSections;
  candidate: MockCandidate;
  section: NamedSection;
}): boolean {
  const named = candidate.area ? areaSections.get(candidate.area) : undefined;
  return Boolean(section.name && named?.includes(section.name));
}

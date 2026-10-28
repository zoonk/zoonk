import { findNamingSections } from "../_utils/name-match";
import { type MockCandidate } from "./mock-plan";

export type AreaSections = ReadonlyMap<string, readonly string[]>;

type NamedSection = { name: string | null };

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

import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { listSubjectNames } from "../../library/exams/subject-names";
import { findNamingSections } from "../_utils/name-match";
import { type MockCandidate } from "./mock-plan";

export type AreaSections = ReadonlyMap<string, readonly string[]>;

type NamedSection = { name: string | null };

export function mapAreasToSections({
  allSections,
  candidates,
  partOf = new Map(),
  structure = null,
}: {
  allSections: readonly NamedSection[];
  candidates: readonly MockCandidate[];
  partOf?: ReadonlyMap<string, string>;
  structure?: ExamStructure | null;
}): AreaSections | null {
  const sections = allSections.flatMap((section) => (section.name ? [section.name] : []));
  const areas = new Set(candidates.flatMap((candidate) => candidate.area ?? []));

  const sectionsOf = (area: string) => {
    const named = [
      ...new Set(
        listSubjectNames({ area, structure }).flatMap((name) =>
          findNamingSections({ name, sections }),
        ),
      ),
    ];

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

/** The section's name and its subjects', which the documents may name its formats by. */
export function listSectionNames({
  areaSections,
  section,
}: {
  areaSections: AreaSections | null;
  section: NamedSection;
}): string[] {
  const { name } = section;

  if (!name) {
    return [];
  }

  const areas = [...(areaSections ?? [])].flatMap(([area, named]) =>
    named.includes(name) ? [area] : [],
  );

  return [name, ...areas];
}

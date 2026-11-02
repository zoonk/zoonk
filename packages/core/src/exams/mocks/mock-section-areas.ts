import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { findAreaSections } from "./exam-parts";
import { type MockCandidate } from "./mock-plan";

export type AreaSections = ReadonlyMap<string, readonly string[]>;

type NamedSection = { name: string | null };

export function mapAreasToSections({
  allSections,
  candidates,
  structure,
}: {
  allSections: readonly NamedSection[];
  candidates: readonly MockCandidate[];
  structure: ExamStructure | null;
}): AreaSections | null {
  const sections = allSections.flatMap((section) => (section.name ? [section.name] : []));
  const areas = new Set(candidates.flatMap((candidate) => candidate.area ?? []));

  const mapped = new Map(
    [...areas].map((area) => [area, findAreaSections({ area, sections, structure })] as const),
  );

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

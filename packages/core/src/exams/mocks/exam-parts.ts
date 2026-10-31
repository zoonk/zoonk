import { normalizeString } from "@zoonk/utils/string";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { matchAreasToSubjects } from "../../view-models/syllabus/_utils/match-areas";
import { findNamingSections } from "../_utils/name-match";
import { isObjectiveSection } from "./written-subject";

type Subject = ExamStructure["subjects"][number];

function findExactSections({
  names,
  sections,
}: {
  names: readonly (string | null | undefined)[];
  sections: readonly string[];
}): string[] {
  const keys = new Set(names.flatMap((name) => (name ? [normalizeString(name)] : [])));
  return sections.filter((section) => keys.has(normalizeString(section)));
}

/**
 * By exact name first, its own, then its group's (the paper it sits in), then its whole subject's;
 * a looser match of those subjects' names only when no section has an exact one.
 */
export function findSubjectSections({
  sections,
  structure,
  subject,
}: {
  sections: readonly string[];
  structure: Pick<ExamStructure, "subjects"> | null;
  subject: Subject;
}): string[] {
  const whole = structure?.subjects.find(
    (other) => other.name === subject.partOf && other.name !== subject.name,
  );

  const exact = [
    [subject.shortName, subject.name],
    [subject.group],
    [whole?.shortName, whole?.name, whole?.group],
  ]
    .map((names) => findExactSections({ names, sections }))
    .find((found) => found.length > 0);

  const loose = () =>
    [subject.shortName, subject.name, whole?.shortName, whole?.name]
      .flatMap((name) => (name ? [findNamingSections({ name, sections })] : []))
      .find((found) => found.length > 0);

  return exact ?? loose() ?? [];
}

/** An area's sections as its subject's, or by the area's own name when no subject has it. */
export function findAreaSections({
  area,
  sections,
  structure,
}: {
  area: string;
  sections: readonly string[];
  structure: ExamStructure | null;
}): string[] {
  const subject = findSubject({ area, structure });

  if (subject) {
    return findSubjectSections({ sections, structure, subject });
  }

  const exact = findExactSections({ names: [area], sections });
  return exact.length > 0 ? exact : findNamingSections({ name: area, sections });
}

function findSubject({
  area,
  structure,
}: {
  area: string;
  structure: ExamStructure | null;
}): Subject | undefined {
  const subjects = structure?.subjects ?? [];
  const index = matchAreasToSubjects({ areas: [area], subjects }).get(area);
  return index === undefined ? undefined : subjects[index];
}

export function getObjectiveSectionNames(structure: ExamStructure | null): string[] {
  return (structure?.mock?.sections ?? [])
    .filter((section) => isObjectiveSection(section) && section.name.trim())
    .map((section) => section.name);
}

/** When no subject is in any section, every section asks every subject, as `mapAreasToSections` places areas. */
function mapSubjectsToSections(structure: ExamStructure | null): Map<string, string[]> {
  const sections = getObjectiveSectionNames(structure);
  const subjects = structure?.subjects ?? [];

  const own = new Map(
    subjects.map((subject) => [
      subject.name,
      findSubjectSections({ sections, structure, subject }),
    ]),
  );

  return [...own.values()].every((named) => named.length === 0)
    ? new Map(subjects.map((subject) => [subject.name, sections]))
    : own;
}

function toSubjectParts(subject: Subject): string[] {
  return [subject.name, subject.group, subject.partOf].filter((name) => typeof name === "string");
}

/** A mock section's own name and the subjects it asks; undefined for an unnamed one, the whole exam. */
export function listSectionParts({
  section,
  structure,
}: {
  section: string | null;
  structure: ExamStructure | null;
}): string[] | undefined {
  if (!section) {
    return undefined;
  }

  const sections = mapSubjectsToSections(structure);

  const asked = (structure?.subjects ?? []).filter((subject) =>
    sections.get(subject.name)?.includes(section),
  );

  return [section, ...asked.flatMap((subject) => toSubjectParts(subject))];
}

/** A plan area's subject and the sections that ask it, so its skills write the formats asked there. */
export function listAreaParts({
  area,
  structure,
}: {
  area: string;
  structure: ExamStructure | null;
}): string[] {
  const subject = findSubject({ area, structure });

  if (!subject) {
    const sections = getObjectiveSectionNames(structure);
    return [area, ...findAreaSections({ area, sections, structure })];
  }

  return [
    area,
    ...toSubjectParts(subject),
    ...(mapSubjectsToSections(structure).get(subject.name) ?? []),
  ];
}

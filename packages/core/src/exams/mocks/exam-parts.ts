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

/** A looser name match only when no section has the subject's exact name. */
export function findSubjectSections({
  sections,
  subject,
}: {
  sections: readonly string[];
  subject: Subject;
}): string[] {
  const exact = findExactSections({ names: [subject.shortName, subject.name], sections });

  if (exact.length > 0) {
    return exact;
  }

  const byShortName = subject.shortName
    ? findNamingSections({ name: subject.shortName, sections })
    : [];

  return byShortName.length > 0
    ? byShortName
    : findNamingSections({ name: subject.name, sections });
}

export function getObjectiveSectionNames(structure: ExamStructure | null): string[] {
  return (structure?.mock?.sections ?? [])
    .filter((section) => isObjectiveSection(section) && section.name.trim())
    .map((section) => section.name);
}

/**
 * As `mapAreasToSections` places areas: a subject no section names sits in its whole subject's
 * sections, and when no subject is named by any section, every section asks every subject.
 */
function mapSubjectsToSections(structure: ExamStructure | null): Map<string, string[]> {
  const sections = getObjectiveSectionNames(structure);
  const subjects = structure?.subjects ?? [];

  const own = new Map(
    subjects.map((subject) => [subject.name, findSubjectSections({ sections, subject })]),
  );

  if ([...own.values()].every((named) => named.length === 0)) {
    return new Map(subjects.map((subject) => [subject.name, sections]));
  }

  return new Map(
    subjects.map((subject) => {
      const named = own.get(subject.name) ?? [];
      const whole = subject.partOf ? (own.get(subject.partOf) ?? []) : [];
      return [subject.name, named.length > 0 ? named : whole];
    }),
  );
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
  const subjects = structure?.subjects ?? [];
  const index = matchAreasToSubjects({ areas: [area], subjects }).get(area);
  const subject = index === undefined ? undefined : subjects[index];

  if (!subject) {
    return [
      area,
      ...findNamingSections({ name: area, sections: getObjectiveSectionNames(structure) }),
    ];
  }

  return [
    area,
    ...toSubjectParts(subject),
    ...(mapSubjectsToSections(structure).get(subject.name) ?? []),
  ];
}

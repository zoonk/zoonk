import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { findNamingSections } from "../_utils/name-match";
import { getPace } from "./mock-plan";
import { isObjectiveSection } from "./written-subject";

type Subject = ExamStructure["subjects"][number];

export function findSubjectSections({
  sections,
  subject,
}: {
  sections: readonly string[];
  subject: Subject;
}): string[] {
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

export function getSubjectPace({
  subject,
  structure,
}: {
  subject: Subject;
  structure: ExamStructure;
}): number {
  const objective = (structure.mock?.sections ?? []).filter(
    (section) => isObjectiveSection(section) && section.minutes && section.questions,
  );

  const [ownName] = findSubjectSections({ sections: getObjectiveSectionNames(structure), subject });

  const own = objective.find((section) => section.name === ownName);
  const paced = own ? [own] : objective;
  const minutes = paced.reduce((sum, section) => sum + (section.minutes ?? 0), 0);
  const questions = paced.reduce((sum, section) => sum + (section.questions ?? 0), 0);

  return questions > 0 ? minutes / questions : getPace(structure);
}

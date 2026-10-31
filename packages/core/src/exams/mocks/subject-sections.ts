import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { findSubjectSections, getObjectiveSectionNames } from "./exam-parts";
import { getPace } from "./mock-plan";
import { isObjectiveSection } from "./written-subject";

type Subject = ExamStructure["subjects"][number];

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

  const [ownName] = findSubjectSections({
    sections: getObjectiveSectionNames(structure),
    structure,
    subject,
  });

  const own = objective.find((section) => section.name === ownName);
  const paced = own ? [own] : objective;
  const minutes = paced.reduce((sum, section) => sum + (section.minutes ?? 0), 0);
  const questions = paced.reduce((sum, section) => sum + (section.questions ?? 0), 0);

  return questions > 0 ? minutes / questions : getPace(structure);
}

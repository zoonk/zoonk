import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getPlannedSubjectQuestions } from "../../library/exams/subject-questions";
import { isObjectiveSection, isQuestionSubject } from "./written-subject";

const DEFAULT_SUBJECT_QUESTIONS = 20;

const MIN_SUBJECT_QUESTIONS = 5;

type Subject = ExamStructure["subjects"][number];

export function isPartOfAnother({
  subject,
  subjects,
}: {
  subject: Subject;
  subjects: readonly Subject[];
}): boolean {
  return Boolean(subject.partOf) && subjects.some((other) => other.name === subject.partOf);
}

function getEvenSubjectQuestions(structure: ExamStructure): number | null {
  const subjects = structure.subjects.filter((subject) =>
    isQuestionSubject({ structure, subject }),
  );

  const sections = (structure.mock?.sections ?? [])
    .filter((section) => isObjectiveSection(section))
    .reduce((sum, section) => sum + (section.questions ?? 0), 0);

  const total = sections || structure.mock?.totalQuestions;
  return total && subjects.length > 0 ? Math.round(total / subjects.length) : null;
}

/** A subject's own mock asks its questions and those of the subjects inside it. */
export function countSubjectPaperQuestions({
  parts,
  structure,
  subject,
}: {
  parts: readonly Subject[];
  structure: ExamStructure;
  subject: Subject;
}): number {
  const partQuestions = parts.reduce(
    (sum, part) => sum + (getPlannedSubjectQuestions({ structure, subject: part }) ?? 0),
    0,
  );

  return Math.max(
    Math.round(
      (getPlannedSubjectQuestions({ structure, subject }) ??
        getEvenSubjectQuestions(structure) ??
        DEFAULT_SUBJECT_QUESTIONS) + partQuestions,
    ),
    MIN_SUBJECT_QUESTIONS,
  );
}

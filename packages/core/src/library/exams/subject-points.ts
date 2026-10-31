import { isWrittenSubject } from "../../exams/mocks/written-subject";
import { type ExamStructure } from "./blueprint-contract";
import {
  getPartMaxPoints,
  getPartPointsPerQuestion,
  getPointsPerQuestion,
  pickPartRows,
} from "./part-points";
import { getPlannedSubjectQuestions } from "./subject-questions";

type Subject = ExamStructure["subjects"][number];

function getAveragePoints(rows: readonly { points: number }[]): number {
  return rows.reduce((sum, row) => sum + row.points, 0) / Math.max(1, rows.length);
}

function getSubjectPointsPerQuestion({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: Subject;
}): number {
  const marking = structure.mock?.scoring.marking ?? [];
  const own = marking.filter((row) => row.part === subject.name);
  const group = subject.group ?? null;

  const fromGroup =
    own.length === 0 && group ? getPartPointsPerQuestion({ name: group, structure }) : null;

  if (fromGroup !== null) {
    return fromGroup;
  }

  const rows = pickPartRows({ marking, names: [subject.name, group] });
  return getPointsPerQuestion(rows) ?? getAveragePoints(rows);
}

/** What the subject's questions are worth, so a test whose questions count double weighs double. */
export function getSubjectPoints({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: Subject;
}): number | null {
  const scoring = structure.mock?.scoring;

  const part = scoring?.parts?.find(
    (item) => item.name === subject.name || item.name === subject.group,
  );

  if (
    part &&
    isWrittenSubject({ structure, subject }) &&
    structure.subjects.filter((item) => item.name === part.name || item.group === part.name)
      .length === 1
  ) {
    return getPartMaxPoints({ marking: scoring?.marking ?? [], part });
  }

  const questions = getPlannedSubjectQuestions({ structure, subject });

  return questions === null
    ? null
    : questions * getSubjectPointsPerQuestion({ structure, subject });
}

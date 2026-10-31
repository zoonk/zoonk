import { listCountedSubjects } from "../../exams/choices/exam-choices";
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

  if (part && isWrittenSubject({ structure, subject })) {
    const subjects = listCountedSubjects(structure.subjects).filter(
      (item) => item.name === part.name || item.group === part.name,
    );

    const objective = subjects.filter((item) => !isWrittenSubject({ structure, subject: item }));
    const written = subjects.length - objective.length;

    const max =
      objective.length === 0
        ? getPartMaxPoints({ marking: scoring?.marking ?? [], part })
        : part.maxPoints;

    const points = objective.map((item) => getSubjectPoints({ structure, subject: item }));

    if (max === null || points.some((value) => value === null)) {
      return null;
    }

    const remaining = max - points.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    return remaining >= 0 && written > 0 ? remaining / written : null;
  }

  const questions = getPlannedSubjectQuestions({ structure, subject });

  return questions === null
    ? null
    : questions * getSubjectPointsPerQuestion({ structure, subject });
}

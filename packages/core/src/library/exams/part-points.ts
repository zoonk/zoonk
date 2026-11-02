import { isWrittenSubject } from "../../exams/mocks/written-subject";
import { type ExamStructure, type MarkingRow, type ScoredPart } from "./blueprint-contract";
import { getPartQuestions } from "./subject-questions";

type Row = Pick<MarkingRow, "part" | "points" | "questions">;

/** The rows of the first name that has its own, else the whole exam's. */
export function pickPartRows<T extends Row>({
  marking,
  names,
}: {
  marking: readonly T[];
  names: readonly (string | null | undefined)[];
}): T[] {
  const own = names
    .filter((name) => typeof name === "string")
    .map((name) => marking.filter((row) => row.part === name))
    .find((rows) => rows.length > 0);

  return own ?? marking.filter((row) => row.part === null);
}

/** Null when its rows mix points without saying how many questions each covers. */
export function getPointsPerQuestion(rows: readonly Row[]): number | null {
  const [first] = rows;

  if (!first) {
    return 1;
  }

  if (rows.every((row) => row.points === first.points)) {
    return first.points;
  }

  const questions = rows.reduce((sum, row) => sum + (row.questions ?? 0), 0);

  return rows.every((row) => row.questions !== null) && questions > 0
    ? rows.reduce((sum, row) => sum + (row.questions ?? 0) * row.points, 0) / questions
    : null;
}

export function getPartMaxPoints({
  marking,
  part,
}: {
  marking: readonly Row[];
  part: Pick<ScoredPart, "maxPoints" | "name" | "questions">;
}): number | null {
  if (part.maxPoints !== null) {
    return part.maxPoints;
  }

  const rows = marking.filter((row) => row.part === part.name);

  if (rows.length > 0 && rows.every((row) => row.questions !== null)) {
    return rows.reduce((sum, row) => sum + (row.questions ?? 0) * row.points, 0);
  }

  const points = getPointsPerQuestion(pickPartRows({ marking, names: [part.name] }));
  return part.questions !== null && points !== null ? part.questions * points : null;
}

export function getPartPointsPerQuestion({
  name,
  structure,
}: {
  name: string;
  structure: ExamStructure;
}): number | null {
  const subjects = structure.subjects.filter(
    (subject) => subject.name === name || subject.group === name,
  );

  if (subjects.some((subject) => isWrittenSubject({ structure, subject }))) {
    return null;
  }

  const scoring = structure.mock?.scoring;
  const part = scoring?.parts?.find((item) => item.name === name);
  const questions = getPartQuestions({ name, structure });
  const max = part ? getPartMaxPoints({ marking: scoring?.marking ?? [], part }) : null;
  return max !== null && questions ? max / questions : null;
}

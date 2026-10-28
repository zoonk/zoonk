import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getSubjectQuestions } from "../../library/exams/subject-questions";
import { withClassTestMock } from "./class-test-mock";
import { isQuestionSubject } from "./written-subject";

function getStatedQuestions(structure: ExamStructure): number | null {
  const sections = (structure.mock?.sections ?? []).reduce(
    (sum, section) => sum + (section.questions ?? 0),
    0,
  );

  return sections > 0 ? sections : (structure.mock?.totalQuestions ?? null);
}

function sumSubjectQuestions(structure: ExamStructure) {
  const objective = structure.subjects.filter((subject) =>
    isQuestionSubject({ structure, subject }),
  );

  const counts = objective.map((subject) => getSubjectQuestions({ structure, subject }));

  if (objective.length === 0 || counts.some((count) => count === null)) {
    return null;
  }

  return {
    fromPast: objective.some((subject) => subject.questions === null),
    questions: counts.reduce<number>((sum, count) => sum + (count ?? 0), 0),
  };
}

export function findExamQuestions({
  noticeQuestions,
  structure,
}: {
  noticeQuestions: number | null;
  structure: ExamStructure;
}): { questions: number; source: "notice" | "pastEdition" } | null {
  const stated = getStatedQuestions(structure) ?? noticeQuestions;

  if (stated) {
    return { questions: stated, source: "notice" };
  }

  const summed = sumSubjectQuestions(structure);

  return summed
    ? { questions: summed.questions, source: summed.fromPast ? "pastEdition" : "notice" }
    : null;
}

export function toMockStructure({
  dayMinutes,
  noticeQuestions,
  ownerId,
  structure,
}: {
  dayMinutes?: number | null;
  noticeQuestions: number | null;
  ownerId: string | null;
  structure: ExamStructure;
}): ExamStructure {
  const found = findExamQuestions({ noticeQuestions, structure });

  if (!found) {
    return withClassTestMock({ dayMinutes, ownerId, structure });
  }

  if (getStatedQuestions(structure)) {
    return structure;
  }

  return {
    ...structure,
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: { description: "", method: "raw" },
      sections: [],
      timeLimitMinutes: null,
      ...structure.mock,
      totalQuestions: found.questions,
    },
  };
}

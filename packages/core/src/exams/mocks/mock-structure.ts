import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getSubjectQuestions } from "../../library/exams/subject-questions";
import { withClassTestMock } from "./class-test-mock";
import { isQuestionSubject } from "./written-subject";

/** The notice's own count: its mock's sections' questions, or its total. */
function getStatedQuestions(structure: ExamStructure): number | null {
  const sections = (structure.mock?.sections ?? []).reduce(
    (sum, section) => sum + (section.questions ?? 0),
    0,
  );

  return sections > 0 ? sections : (structure.mock?.totalQuestions ?? null);
}

/**
 * The exam's objective questions added up subject by subject, when every objective subject has a
 * count: the notice's own, or a past edition's where the notice gives none (`fromPast`).
 */
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

/** How many questions the exam has, by where it's stated (see `toMockStructure`). */
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

/**
 * The structure mocks copy: the blueprint's, with the exam's number of questions where its
 * reading left the mock without one, from the notice's edition (`noticeQuestions`) or else a past
 * edition's count; a class test whose material states none copies a short test (see
 * `withClassTestMock`). A mock never makes up the exam's size without saying so (see
 * `getMockSizeSource`).
 */
export function toMockStructure({
  dayMinutes,
  noticeQuestions,
  ownerId,
  structure,
}: {
  /** The time the learner gives a class test's mock day, which its short test fits. */
  dayMinutes?: number | null;
  /** The questions the notice's edition states (`ExamEdition.questionCount`). */
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

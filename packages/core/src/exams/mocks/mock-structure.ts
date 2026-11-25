import { type ExamStructure } from "../../library/exams/blueprint-contract";
import {
  getPlannedSubjectQuestions,
  isCountedByNotice,
} from "../../library/exams/subject-questions";
import { withClassTestMock } from "./class-test-mock";
import { getDaySections, sectionQuotas } from "./mock-day-sections";
import { getMockDays } from "./mock-plan";
import { countSubjectPaperQuestions, isPartOfAnother } from "./subject-paper-size";
import { isObjectiveSection, isQuestionSubject } from "./written-subject";

/** The largest real exams ask about 320 questions in a sitting and about 600 over all their days. */
const MAX_SITTING_QUESTIONS = 600;
export const MAX_EXAM_QUESTIONS = 1200;

type MockSizing = { noticeQuestions: number | null; structure: ExamStructure };

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

  const counts = objective.map((subject) => getPlannedSubjectQuestions({ structure, subject }));

  if (objective.length === 0 || counts.some((count) => count === null)) {
    return null;
  }

  return {
    fromPast: objective.some((subject) => !isCountedByNotice({ structure, subject })),
    questions: Math.round(counts.reduce<number>((sum, count) => sum + (count ?? 0), 0)),
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

function sizeMock({
  dayMinutes,
  noticeQuestions,
  ownerId,
  structure,
}: MockSizing & { dayMinutes?: number | null; ownerId: string | null }): ExamStructure {
  const found = findExamQuestions({ noticeQuestions, structure });

  if (!found) {
    return withClassTestMock({ dayMinutes, ownerId, structure });
  }

  if (getStatedQuestions(structure)) {
    return structure;
  }

  const sections = structure.mock?.sections ?? [];
  const objective = sections.filter((section) => isObjectiveSection(section));
  const [only] = objective.length === 1 ? objective : [];

  return {
    ...structure,
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: { description: "", method: "raw" },
      timeLimitMinutes: null,
      ...structure.mock,
      sections: sections.map((section) =>
        section === only ? { ...section, questions: found.questions } : section,
      ),
      totalQuestions: found.questions,
    },
  };
}

function addUp(counts: readonly number[]): number {
  return counts.reduce((total, count) => total + count, 0);
}

function isRealExamSize(structure: ExamStructure): boolean {
  const listening = new Set(
    (structure.mock?.sections ?? [])
      .filter((section) => section.kind === "listening")
      .map((section) => section.name),
  );

  const days = getMockDays(structure).map((day) =>
    addUp(sectionQuotas(getDaySections({ day, listening, structure }), 1)),
  );

  const objective = structure.subjects.filter((subject) =>
    isQuestionSubject({ structure, subject }),
  );

  const subjects = objective
    .filter((subject) => !isPartOfAnother({ subject, subjects: objective }))
    .map((subject) =>
      countSubjectPaperQuestions({
        parts: objective.filter((part) => part.partOf === subject.name),
        structure,
        subject,
      }),
    );

  return (
    [...days, ...subjects].every((questions) => questions <= MAX_SITTING_QUESTIONS) &&
    addUp(days) <= MAX_EXAM_QUESTIONS
  );
}

function withoutQuestionCounts(structure: ExamStructure): ExamStructure {
  const { mock } = structure;

  return {
    ...structure,
    mock: mock && {
      ...mock,
      scoring: {
        ...mock.scoring,
        ...(mock.scoring.marking && {
          marking: mock.scoring.marking.map((row) => ({ ...row, questions: null })),
        }),
        ...(mock.scoring.parts && {
          parts: mock.scoring.parts.map((part) => ({ ...part, questions: null })),
        }),
      },
      sections: mock.sections.map((section) => ({ ...section, questions: null })),
      totalQuestions: null,
    },
    pastQuestions: null,
    subjects: structure.subjects.map((subject) => ({ ...subject, questions: null })),
  };
}

/**
 * Every question a mock asks is written by a model, and the counts come from a document a learner
 * can upload. A paper larger than any real exam is misread or made up: its counts are set aside,
 * and when its sittings alone are still that large, so are its conditions.
 */
export function findPlausibleSizing({
  noticeQuestions,
  ownerId,
  structure,
}: MockSizing & { ownerId: string | null }): MockSizing {
  if (isRealExamSize(sizeMock({ noticeQuestions, ownerId, structure }))) {
    return { noticeQuestions, structure };
  }

  const uncounted = withoutQuestionCounts(structure);

  if (isRealExamSize(sizeMock({ noticeQuestions: null, ownerId, structure: uncounted }))) {
    return { noticeQuestions: null, structure: uncounted };
  }

  return { noticeQuestions: null, structure: { ...uncounted, mock: null } };
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
  return sizeMock({
    dayMinutes,
    ownerId,
    ...findPlausibleSizing({ noticeQuestions, ownerId, structure }),
  });
}

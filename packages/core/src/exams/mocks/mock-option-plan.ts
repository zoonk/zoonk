import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { namesMatch } from "../_utils/name-match";
import { type MockOption, getSubjectShares, isOptionArea, subjectName } from "./mock-options";
import {
  type MockCandidate,
  type MockPlan,
  getMockDays,
  getPlannedItemIds,
  planMock,
} from "./mock-plan";
import { isWrittenSubject } from "./written-subject";

/**
 * The questions a mock may ask, each under its notice subject's short name, the one the exam's
 * sections name ("Matemática" in "Ciências da Natureza e Matemática") where the plan names its
 * areas in full ("Matemática e suas Tecnologias"). A question of a written test (a redação) or of
 * an area outside the notice's objective subjects (study strategy) is never asked. When no
 * question's area is one of the notice's subjects, they stay as they are.
 */
export function toSubjectCandidates({
  candidates,
  structure,
}: {
  candidates: readonly MockCandidate[];
  structure: ExamStructure | null;
}): MockCandidate[] {
  const objective = (structure?.subjects ?? []).filter(
    (subject) => structure && !isWrittenSubject({ structure, subject }),
  );

  const subjectOf = (area: string | null) =>
    area
      ? objective.find(
          (subject) => namesMatch(area, subject.name) || namesMatch(area, subjectName(subject)),
        )
      : undefined;

  const matched = candidates.map((candidate) => ({
    candidate,
    subject: subjectOf(candidate.area),
  }));

  if (!matched.some((entry) => entry.subject)) {
    return [...candidates];
  }

  return matched.flatMap(({ candidate, subject }) =>
    subject ? [{ ...candidate, area: subjectName(subject) }] : [],
  );
}

/**
 * Every exam day's full mock in order, never a question twice: the whole exam from the questions
 * it may ask, each section asking the ones of its subjects. A diagnostic mock (see
 * `planPlacementMock`) passes only the questions it picked, so each section asks those. Never
 * adaptive: a later module's easier and harder sets would split what's picked.
 */
export function planWholeExam({
  candidates,
  structure,
}: {
  candidates: readonly MockCandidate[];
  structure: ExamStructure | null;
}): MockPlan {
  const plans = getMockDays(structure).reduce<MockPlan[]>((done, _day, index) => {
    const used = new Set(done.flatMap((plan) => getPlannedItemIds(plan)));
    const left = candidates.filter((candidate) => !used.has(candidate.itemId));

    return [
      ...done,
      planMock({
        adaptive: false,
        candidates: left,
        fullLength: true,
        mockNumber: index,
        structure,
        subjectShares: getSubjectShares(structure),
      }),
    ];
  }, []);

  return {
    day: null,
    fullLength: true,
    minutes: plans.reduce((sum, plan) => sum + plan.minutes, 0),
    sections: plans.flatMap((plan) => plan.sections),
    written: [],
  };
}

/**
 * The structure a subject's mock copies: one section named for the subject, with its questions
 * and minutes, so it's planned like an exam day.
 */
/** The section a subject's mock sits, named as the options name the subject. */
function getSubjectSectionName(option: MockOption): string {
  return option.areas[0] ?? option.area ?? "";
}

function toSubjectStructure({
  option,
  structure,
}: {
  option: MockOption;
  structure: ExamStructure;
}): ExamStructure {
  const mock = structure.mock ?? {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" as const },
    sections: [],
    timeLimitMinutes: null,
    totalQuestions: null,
  };

  return {
    ...structure,
    mock: {
      ...mock,
      adaptive: false,
      sections: [
        {
          day: null,
          kind: "objective",
          minutes: option.minutes,
          name: getSubjectSectionName(option),
          questions: option.questions,
        },
      ],
      timeLimitMinutes: option.minutes,
      totalQuestions: option.questions,
    },
  };
}

/**
 * Plans a mock taken any time from the questions it may ask: an exam day in full or half of it,
 * or one subject, at the exam's pace and never a question twice.
 */
export function planOptionMock({
  candidates,
  option,
  structure,
}: {
  candidates: readonly MockCandidate[];
  option: MockOption;
  structure: ExamStructure | null;
}): MockPlan {
  if (option.kind === "area" && structure) {
    const section = getSubjectSectionName(option);

    // The subject's questions carry its section's name, so the section asks every one of them.
    const own = candidates
      .filter(
        (candidate) =>
          candidate.area !== null && isOptionArea({ area: candidate.area, option, structure }),
      )
      .map((candidate) => ({ ...candidate, area: section }));

    return planMock({
      adaptive: false,
      candidates: own,
      fullLength: true,
      mockNumber: 0,
      structure: toSubjectStructure({ option, structure }),
    });
  }

  const days = getMockDays(structure);
  const bySubject = toSubjectCandidates({ candidates, structure });

  return planMock({
    adaptive: structure?.mock?.adaptive ?? false,
    candidates: bySubject,
    fullLength: option.kind === "full",
    mockNumber: Math.max(0, days.indexOf(option.day)),
    structure,
    subjectShares: getSubjectShares(structure),
  });
}

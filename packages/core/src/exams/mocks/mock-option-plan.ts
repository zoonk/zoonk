import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type MockOption, findAreaSubject, getSubjectShares, isOptionArea } from "./mock-options";
import {
  type MockCandidate,
  type MockPlan,
  getMockDays,
  getPlannedItemIds,
  planMock,
} from "./mock-plan";
import { type MockEssayCandidate } from "./written-parts";
import { isQuestionSubject } from "./written-subject";

/**
 * The questions a mock may ask, each under its notice subject's name, as the Journey names it,
 * whatever name the plan gives its area ("Professional Ethics" for the OAB's "Statute of the Legal
 * Profession and of the OAB…"). A question of a written test (an essay) or of
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
  const subjectOf = (area: string | null) => {
    const subject = area ? findAreaSubject({ area, structure }) : undefined;
    return subject && structure && isQuestionSubject({ structure, subject }) ? subject : undefined;
  };

  const matched = candidates.map((candidate) => ({
    candidate,
    subject: subjectOf(candidate.area),
  }));

  if (!matched.some((entry) => entry.subject)) {
    return [...candidates];
  }

  return matched.flatMap(({ candidate, subject }) =>
    subject ? [{ ...candidate, area: subject.name }] : [],
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
    reused: plans.reduce((sum, plan) => sum + plan.reused, 0),
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
  essays = [],
  listening,
  option,
  speaking,
  structure,
}: {
  candidates: readonly MockCandidate[];
  /** The exam's essays, which a full mock's written parts ask (see `loadMockEssays`). */
  essays?: readonly MockEssayCandidate[];
  /** The recordings an exam day's listening sections play (see `planMock`). */
  listening?: ReadonlyMap<string, readonly MockCandidate[]>;
  option: MockOption;
  /** The goal's exam has a speaking paper, which a full mock sits (see `planMock`). */
  speaking?: boolean;
  structure: ExamStructure | null;
}): MockPlan {
  if (option.kind === "area" && structure) {
    const section = getSubjectSectionName(option);
    const parts = option.areas.filter((name) => name !== section);

    // The subject's questions carry its section's name, so the section asks every one of them;
    // an option counted inside it keeps its own name, so the section asks its share of them.
    const own = candidates.flatMap((candidate) => {
      if (candidate.area === null || !isOptionArea({ area: candidate.area, option, structure })) {
        return [];
      }

      const subject = findAreaSubject({ area: candidate.area, structure })?.name;
      return [{ ...candidate, area: subject && parts.includes(subject) ? subject : section }];
    });

    return planMock({
      adaptive: false,
      candidates: own,
      fullLength: true,
      mockNumber: 0,
      structure: toSubjectStructure({ option, structure }),
      subjectShares:
        parts.length > 0
          ? getSubjectShares(structure).filter((share) => option.areas.includes(share.name))
          : [],
    });
  }

  const days = getMockDays(structure);

  // A full mock is the real exam: questions the learner answered before never pad it, so a bank
  // short of new ones leaves it short (said on the mock) rather than repeating them.
  const asked =
    option.kind === "full" ? candidates.filter((candidate) => !candidate.answered) : candidates;

  const bySubject = toSubjectCandidates({ candidates: asked, structure });

  return planMock({
    adaptive: structure?.mock?.adaptive ?? false,
    candidates: bySubject,
    essays,
    fullLength: option.kind === "full",
    listening,
    mockNumber: Math.max(0, days.indexOf(option.day)),
    speaking,
    structure,
    subjectShares: getSubjectShares(structure),
  });
}

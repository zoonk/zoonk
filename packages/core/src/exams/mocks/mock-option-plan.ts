import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { listAreaParts } from "./exam-parts";
import { type MockOption, findAreaSubject, getSubjectShares, isOptionArea } from "./mock-options";
import { type MockCandidate, type MockPlan, getMockDays, planMock } from "./mock-plan";
import { type MockEssayCandidate } from "./written-parts";
import { isQuestionSubject } from "./written-subject";
import { onlyObjectiveStructure, planWrittenTest } from "./written-test-plan";

export function toSubjectCandidates({
  candidates,
  structure,
}: {
  candidates: readonly MockCandidate[];
  structure: ExamStructure | null;
}): MockCandidate[] {
  const matched = candidates.map((candidate) => {
    const subject = candidate.area
      ? findAreaSubject({ area: candidate.area, structure })
      : undefined;

    const asked = subject && structure && isQuestionSubject({ structure, subject });

    return { asked, candidate, subject };
  });

  // Areas the notice doesn't name still fill a paper; a written or spoken paper's never do.
  if (!matched.some(({ asked }) => asked)) {
    return matched.flatMap(({ candidate, subject }) => (subject ? [] : [candidate]));
  }

  return matched.flatMap(({ asked, candidate, subject }) =>
    asked && subject ? [{ ...candidate, area: subject.name }] : [],
  );
}

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

export function planOptionMock({
  candidates,
  essays = [],
  listening,
  option,
  speaking,
  structure,
}: {
  candidates: readonly MockCandidate[];
  essays?: readonly MockEssayCandidate[];
  listening?: ReadonlyMap<string, readonly MockCandidate[]>;
  option: MockOption;
  speaking?: boolean;
  structure: ExamStructure | null;
}): MockPlan {
  if (option.kind === "written") {
    return planWrittenTest({ day: option.day, essays, structure });
  }

  if (option.kind === "objective") {
    return planOptionMock({
      candidates,
      option: { ...option, kind: "full" },
      structure: onlyObjectiveStructure(structure),
    });
  }

  if (option.kind === "area" && structure) {
    const section = getSubjectSectionName(option);
    const parts = option.areas.filter((name) => name !== section);

    const areaParts = [option.area, ...option.areas].flatMap((area) =>
      area ? listAreaParts({ area, structure }) : [],
    );

    const own = candidates.flatMap((candidate) => {
      if (candidate.area === null || !isOptionArea({ area: candidate.area, option, structure })) {
        return [];
      }

      const subject = findAreaSubject({ area: candidate.area, structure })?.name;
      return [{ ...candidate, area: subject && parts.includes(subject) ? subject : section }];
    });

    return planMock({
      adaptive: false,
      areaParts,
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

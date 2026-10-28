import { type ExamStructure, type SectionNavigation } from "../../library/exams/blueprint-contract";
import { fitToClock } from "./mock-clock-fit";
import {
  DEFAULT_SECTION_QUESTIONS,
  getDaySections,
  getObjectiveSections,
  sectionMinutes,
  toSectionRules,
} from "./mock-day-sections";
import { getFormatQuotas, getMockFormatMix } from "./mock-format-mix";
import { planListeningSection, planSpeakingSection } from "./mock-oral-sections";
import { countReused } from "./mock-reuse";
import { type MockRouting, isNextModule, toRouting } from "./mock-routing";
import { mapAreasToSections } from "./mock-section-areas";
import { getSectionName, orderBySubjectShares, sectionPool } from "./mock-section-pool";
import { takeQuestions } from "./mock-sets";
import { type SubjectShare, getPartOfAreas, splitPartShares } from "./mock-subject-shares";
import {
  type MockDayWrittenPart,
  type MockEssayCandidate,
  withWrittenParts,
} from "./written-parts";

const WEEKLY_MOCK_SHARE = 0.5;

const DEFAULT_MINUTES_PER_QUESTION = 3;

export type MockCandidate = {
  answered: boolean;
  area: string | null;
  difficulty: number | null;
  format?: string | null;
  itemId: string;
  set?: { id: string; position: number; size: number };
  skillId: string;
};

export type MockSectionPlan = {
  breakAfterMinutes?: number | null;
  essays: string[];
  itemIds: string[];
  kind?: "listening" | "speaking";
  minutes: number;
  name: string | null;
  questions: number;
  routing: MockRouting | null;
  navigation?: SectionNavigation | null;
  tools?: string | null;
};

export type MockPlan = {
  day: number | null;
  formatsWanted?: Record<string, number>;
  fullLength: boolean;
  minutes: number;
  reused: number;
  sections: MockSectionPlan[];
  written: MockDayWrittenPart[];
};

function asksAnything(section: MockSectionPlan): boolean {
  return section.questions > 0 || section.essays.length > 0 || section.kind === "speaking";
}

export function getMockDays(structure: ExamStructure | null): (number | null)[] {
  const days = [...new Set((structure?.mock?.sections ?? []).map((section) => section.day))];
  return days.length > 0 ? days : [null];
}

export function getPace(structure: ExamStructure | null): number {
  const mock = structure?.mock;

  if (mock?.timeLimitMinutes && mock.totalQuestions) {
    return mock.timeLimitMinutes / mock.totalQuestions;
  }

  return DEFAULT_MINUTES_PER_QUESTION;
}

export function planMock({
  adaptive,
  candidates,
  clock,
  essays = [],
  fullLength,
  listening = new Map(),
  mockNumber,
  speaking = false,
  structure,
  subjectShares = [],
}: {
  adaptive: boolean;
  candidates: readonly MockCandidate[];
  clock?: number;
  essays?: readonly MockEssayCandidate[];
  fullLength: boolean;
  listening?: ReadonlyMap<string, readonly MockCandidate[]>;
  mockNumber: number;
  speaking?: boolean;
  structure: ExamStructure | null;
  subjectShares?: readonly SubjectShare[];
}): MockPlan {
  const days = getMockDays(structure);
  const day = days[mockNumber % days.length] ?? null;

  const sections = getDaySections({
    day,
    listening: new Set(listening.keys()),
    speaking: speaking && fullLength,
    structure,
  });

  const pace = getPace(structure);
  const share = fullLength ? 1 : WEEKLY_MOCK_SHARE;
  const objective = getObjectiveSections(structure);
  const allSections = objective.length > 0 ? objective : sections;
  const shares = splitPartShares({ candidates, shares: subjectShares });
  const mix = getMockFormatMix(structure);

  const areaSections = mapAreasToSections({
    allSections,
    candidates,
    partOf: getPartOfAreas(subjectShares),
  });

  const byArea = areaSections !== null;

  const planned = sections.reduce<{
    formatsWanted: Record<string, number>;
    plans: MockSectionPlan[];
    used: Set<string>;
  }>(
    (state, section, index) => {
      const wanted = Math.ceil((section.questions ?? DEFAULT_SECTION_QUESTIONS) * share);
      const recordings = section.kind === "listening" ? listening.get(section.name ?? "") : null;

      if (recordings) {
        const plan = planListeningSection({ pace, pool: recordings, section, wanted });

        const timed =
          clock === undefined
            ? plan
            : { ...plan, minutes: sectionMinutes({ pace, picked: wanted, section }) };

        return { ...state, plans: [...state.plans, timed] };
      }

      if (section.kind === "speaking") {
        return { ...state, plans: [...state.plans, planSpeakingSection(section)] };
      }

      const pool = orderBySubjectShares({
        pool: sectionPool({ areaSections, candidates, section }).filter(
          (candidate) => !state.used.has(candidate.itemId),
        ),
        portion: share,
        subjectShares: shares,
        wanted,
      });

      const previous = sections[index - 1]?.name ?? null;
      const routed = adaptive && isNextModule({ current: section.name, previous });
      const routing = routed ? toRouting({ pool, wanted }) : null;
      const quotas = getFormatQuotas({ mix, wanted });
      const picked = routing ? [] : takeQuestions({ pool, quotas, wanted });
      const reserved = routing ? [...routing.easier, ...routing.harder] : picked;
      const questions = routing ? Math.min(wanted, routing.easier.length) : picked.length;

      const plan: MockSectionPlan = {
        ...toSectionRules(section),
        essays: [],
        itemIds: picked,
        minutes: sectionMinutes({
          pace,
          picked: clock === undefined ? questions : wanted,
          section,
        }),
        name: getSectionName({ allSections, byArea, section }),
        questions,
        routing,
      };

      const formatsWanted = routing
        ? state.formatsWanted
        : Object.fromEntries(
            [...quotas].map(([key, count]) => [key, (state.formatsWanted[key] ?? 0) + count]),
          );

      return {
        formatsWanted,
        plans: [...state.plans, plan],
        used: new Set([...state.used, ...reserved]),
      };
    },
    {
      formatsWanted: {},
      plans: [],
      used: new Set([...listening.values()].flat().map((candidate) => candidate.itemId)),
    },
  );

  const written = withWrittenParts({ day, essays, fullLength, sections: planned.plans, structure });

  const asked = written.sections.filter((plan) => asksAnything(plan));
  const plans = clock === undefined ? asked : fitToClock({ clock, sections: asked });

  return {
    day,
    formatsWanted: planned.formatsWanted,
    fullLength,
    minutes: clock ?? plans.reduce((sum, plan) => sum + plan.minutes, 0),
    reused: countReused({ candidates, sections: plans }),
    sections: plans,
    written: written.written,
  };
}

export function outlineMock({
  clock,
  day: requestedDay,
  essays = [],
  fullLength,
  listening,
  speaking = false,
  structure,
}: {
  clock?: number;
  day?: number | null;
  essays?: readonly MockEssayCandidate[];
  fullLength: boolean;
  listening?: ReadonlySet<string>;
  speaking?: boolean;
  structure: ExamStructure | null;
}): MockPlan {
  const day = requestedDay === undefined ? (getMockDays(structure)[0] ?? null) : requestedDay;
  const pace = getPace(structure);
  const share = fullLength ? 1 : WEEKLY_MOCK_SHARE;

  const daySections = getDaySections({
    day,
    listening,
    speaking: speaking && fullLength,
    structure,
  });

  const asked = daySections.map((section): MockSectionPlan => {
    if (section.kind === "speaking") {
      return planSpeakingSection(section);
    }

    const questions = Math.ceil((section.questions ?? DEFAULT_SECTION_QUESTIONS) * share);

    return {
      ...toSectionRules(section),
      essays: [],
      itemIds: [],
      ...(section.kind === "listening" && { kind: "listening" as const }),
      minutes: sectionMinutes({ pace, picked: questions, section }),
      name: section.name,
      questions,
      routing: null,
    };
  });

  const { sections, written } = withWrittenParts({
    day,
    essays,
    fullLength,
    sections: asked,
    structure,
  });

  return {
    day,
    fullLength,
    minutes: clock ?? sections.reduce((sum, section) => sum + section.minutes, 0),
    reused: 0,
    sections,
    written,
  };
}

export function getMockClock({
  day,
  fullLength,
  structure,
}: {
  day: number | null;
  fullLength: boolean;
  structure: ExamStructure | null;
}): number {
  const listening = new Set(
    (structure?.mock?.sections ?? []).flatMap((section) =>
      section.day === day && section.kind === "listening" ? [section.name] : [],
    ),
  );

  const outline = outlineMock({ day, fullLength, listening, structure });

  return outline.written
    .filter((part) => !part.asked)
    .reduce((sum, part) => sum + (part.minutes ?? 0), outline.minutes);
}

export function listMockClocks(
  structure: ExamStructure | null,
): { day: number | null; fullMinutes: number; minutes: number }[] {
  return getMockDays(structure).map((day) => ({
    day,
    fullMinutes: getMockClock({ day, fullLength: true, structure }),
    minutes: getMockClock({ day, fullLength: false, structure }),
  }));
}

export function getWeeklyMockMinutes({
  fullLength,
  structure,
}: {
  fullLength: boolean;
  structure: ExamStructure | null;
}): number {
  return getMockClock({ day: getMockDays(structure)[0] ?? null, fullLength, structure });
}

/** Includes both alternatives of routed modules; use `countPlannedQuestions` for the number actually answered. */
export function getPlannedItemIds(plan: MockPlan): string[] {
  const ids = plan.sections.flatMap((section) =>
    section.routing ? [...section.routing.easier, ...section.routing.harder] : section.itemIds,
  );

  return [...new Set(ids)];
}

export function countPlannedQuestions(plan: MockPlan): number {
  return plan.sections.reduce((sum, section) => sum + section.questions, 0);
}

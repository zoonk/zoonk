import { type ExamStructure, type SectionNavigation } from "../../library/exams/blueprint-contract";
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

/**
 * A weekly mock sits one exam day in the blueprint's section order and at its pace. Regular weeks
 * take half of each section, like the two-and-a-half-hour Sunday mocks prep schools run; the final
 * stretch sits the full day. Mocks rotate through the exam's days week by week.
 */
const WEEKLY_MOCK_SHARE = 0.5;

/** Exams like ENEM give about three minutes per question, reading included. */
const DEFAULT_MINUTES_PER_QUESTION = 3;

/**
 * A bank item a mock can ask: its area (the plan graph's), how hard it is, and whether the learner
 * answered it before (`answered`), which a mock asks only once there are no new ones left.
 */
export type MockCandidate = {
  answered: boolean;
  area: string | null;
  difficulty: number | null;
  /**
   * Which of the exam's formats it's in (`getItemFormatKey`), so a section asks each its share;
   * absent or null for one the exam's mix doesn't ask.
   */
  format?: string | null;
  itemId: string;
  /**
   * The set it belongs to (a text, a case or a chart several questions read): its place in it and
   * how many questions it has. A mock asks a set whole (`takeQuestions`); absent on its own.
   */
  set?: { id: string; position: number; size: number };
  skillId: string;
};

export type MockSectionPlan = {
  /** The break the notice gives after it, before the next section's clock starts, in minutes. */
  breakAfterMinutes?: number | null;
  /**
   * The essays it asks on its clock: a full mock's written part, beside the day's questions (ENEM's
   * essay) or as a section of its own (a discursive test in the afternoon).
   */
  essays: string[];
  itemIds: string[];
  /**
   * `listening`: its questions are on the recordings it plays, whole sets in the parts' order;
   * `speaking`: the exam's speaking paper, its tasks live calls (see `planSpeakingSection`).
   */
  kind?: "listening" | "speaking";
  minutes: number;
  /** The blueprint's section name, or null for an exam that doesn't name its sections. */
  name: string | null;
  questions: number;
  routing: MockRouting | null;
  /** How candidates move through it, as the notice says; null when they move freely. */
  navigation?: SectionNavigation | null;
  /** What may be used or is given in it, in one sentence of the notice's. */
  tools?: string | null;
};

export type MockPlan = {
  /** Which exam day the mock copies, when the exam runs over several days. */
  day: number | null;
  /**
   * How many of its questions each of the exam's formats asks (`getFormatQuotas`, by key), in the
   * sections picked by format; an adaptive exam's routed modules aren't. Absent on an outline.
   */
  formatsWanted?: Record<string, number>;
  fullLength: boolean;
  minutes: number;
  /** Questions it asks again that the learner answered before: the bank had no new ones left. */
  reused: number;
  sections: MockSectionPlan[];
  /**
   * The day's written parts in a full-length mock, each asked with the exam's essays or left out
   * because the bank has none for it yet; a short one sits half the objective part and lists none.
   */
  written: MockDayWrittenPart[];
};

/** A section that asks something: its questions, its essays, or its speaking paper. */
function asksAnything(section: MockSectionPlan): boolean {
  return section.questions > 0 || section.essays.length > 0 || section.kind === "speaking";
}

/** The exam's days in the blueprint's order; one unnamed day when it doesn't split them. */
export function getMockDays(structure: ExamStructure | null): (number | null)[] {
  const days = [...new Set((structure?.mock?.sections ?? []).map((section) => section.day))];
  return days.length > 0 ? days : [null];
}

/** Minutes per question at the exam's own pace, reading included. */
export function getPace(structure: ExamStructure | null): number {
  const mock = structure?.mock;

  if (mock?.timeLimitMinutes && mock.totalQuestions) {
    return mock.timeLimitMinutes / mock.totalQuestions;
  }

  return DEFAULT_MINUTES_PER_QUESTION;
}

/**
 * Plans a mock's sections from the questions it may use: one exam day, section by section in the
 * blueprint's order, each with its share of questions at the real pace. Questions go to the section
 * whose name covers their area, and a question is never asked twice. An adaptive exam's later
 * module keeps an easier and a harder set until the module before it is done.
 */
export function planMock({
  adaptive,
  candidates,
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
  /** The exam's essays a full-length mock's written parts may ask, in the order to ask them. */
  essays?: readonly MockEssayCandidate[];
  fullLength: boolean;
  /**
   * The recordings each listening section can play, by its name (`loadListeningCandidates`): a
   * section without them isn't sat.
   */
  listening?: ReadonlyMap<string, readonly MockCandidate[]>;
  /** How many mocks the learner already finished for the goal: the days take turns. */
  mockNumber: number;
  /** The goal's exam has a speaking paper a full mock sits (see `planSpeakingSection`). */
  speaking?: boolean;
  structure: ExamStructure | null;
  /** The notice's subjects with their questions, so a section asks each its share. */
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
        return { ...state, plans: [...state.plans, plan] };
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
        minutes: sectionMinutes({ pace, picked: questions, section }),
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
    { formatsWanted: {}, plans: [], used: new Set() },
  );

  const written = withWrittenParts({ day, essays, fullLength, sections: planned.plans, structure });

  const plans = written.sections.filter((plan) => asksAnything(plan));

  return {
    day,
    formatsWanted: planned.formatsWanted,
    fullLength,
    minutes: plans.reduce((sum, plan) => sum + plan.minutes, 0),
    reused: countReused({ candidates, sections: plans }),
    sections: plans,
    written: written.written,
  };
}

/**
 * A mock as the exam's conditions set it, before its questions are picked: one exam day's
 * sections (the first day unless `day` names another) with their share of questions at the real
 * pace. The plan reserves its time, and the week's card says what's coming while the question bank
 * is still filling up.
 */
export function outlineMock({
  day: requestedDay,
  essays = [],
  fullLength,
  listening,
  speaking = false,
  structure,
}: {
  day?: number | null;
  /** The exam's essays a full-length mock's written parts may ask (see `planMock`). */
  essays?: readonly MockEssayCandidate[];
  fullLength: boolean;
  /** The listening sections that have recordings to play, by name (see `planMock`). */
  listening?: ReadonlySet<string>;
  /** The goal's exam has a speaking paper a full mock sits (see `planMock`). */
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
    minutes: sections.reduce((sum, section) => sum + section.minutes, 0),
    reused: 0,
    sections,
    written,
  };
}

/**
 * How long the goal's weekly mock takes, for the plan to reserve the day: half the first exam day
 * on regular weeks; the whole day in the final stretch, its written test with a time of its own
 * included (a full mock asks it), as the real exam's day runs.
 */
export function getWeeklyMockMinutes({
  fullLength,
  structure,
}: {
  fullLength: boolean;
  structure: ExamStructure | null;
}): number {
  const outline = outlineMock({ fullLength, structure });

  return outline.written
    .filter((part) => !part.asked)
    .reduce((sum, part) => sum + (part.minutes ?? 0), outline.minutes);
}

/** Every question a mock reserves, routed modules' both sets included. */
export function getPlannedItemIds(plan: MockPlan): string[] {
  const ids = plan.sections.flatMap((section) =>
    section.routing ? [...section.routing.easier, ...section.routing.harder] : section.itemIds,
  );

  return [...new Set(ids)];
}

/** Questions a learner answers in the mock: routed modules count once. */
export function countPlannedQuestions(plan: MockPlan): number {
  return plan.sections.reduce((sum, section) => sum + section.questions, 0);
}

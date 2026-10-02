import { interleave } from "@zoonk/utils/interleave";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { namesMatch } from "../_utils/name-match";

/**
 * A weekly mock sits one exam day in the blueprint's section order and at its pace. Regular weeks
 * take half of each section, like the two-and-a-half-hour Sunday mocks prep schools run; the final
 * stretch sits the full day. Mocks rotate through the exam's days week by week.
 */
const WEEKLY_MOCK_SHARE = 0.5;

/** Without a stated size, a mock is a morning's worth of questions. */
const DEFAULT_SECTION_QUESTIONS = 45;

/** Exams like ENEM give about three minutes per question, reading included. */
const DEFAULT_MINUTES_PER_QUESTION = 3;

/** A bank item a mock can ask: its area (the plan graph's), and how hard it is. */
export type MockCandidate = {
  area: string | null;
  difficulty: number | null;
  itemId: string;
  skillId: string;
};

/**
 * An adaptive exam's later module: its questions wait for the module before it. A learner who did
 * well there gets the harder set, like the digital SAT's second module.
 */
type MockRouting = { easier: string[]; harder: string[] };

type MockSectionPlan = {
  itemIds: string[];
  minutes: number;
  /** The blueprint's section name, or null for an exam that doesn't name its sections. */
  name: string | null;
  questions: number;
  routing: MockRouting | null;
};

export type MockPlan = {
  /** Which exam day the mock copies, when the exam runs over several days. */
  day: number | null;
  fullLength: boolean;
  minutes: number;
  sections: MockSectionPlan[];
};

type BlueprintSection = { minutes: number | null; name: string | null; questions: number | null };

function getDays(structure: ExamStructure | null): (number | null)[] {
  const days = [...new Set((structure?.mock?.sections ?? []).map((section) => section.day))];
  return days.length > 0 ? days : [null];
}

function getPace(structure: ExamStructure | null): number {
  const mock = structure?.mock;

  if (mock?.timeLimitMinutes && mock.totalQuestions) {
    return mock.timeLimitMinutes / mock.totalQuestions;
  }

  return DEFAULT_MINUTES_PER_QUESTION;
}

function getDaySections({
  day,
  structure,
}: {
  day: number | null;
  structure: ExamStructure | null;
}): BlueprintSection[] {
  const sections = (structure?.mock?.sections ?? []).filter((section) => section.day === day);

  if (sections.length > 0) {
    return sections;
  }

  return [
    {
      minutes: structure?.mock?.timeLimitMinutes ?? null,
      name: null,
      questions: structure?.mock?.totalQuestions ?? DEFAULT_SECTION_QUESTIONS,
    },
  ];
}

function sectionMinutes({
  pace,
  picked,
  section,
}: {
  pace: number;
  picked: number;
  section: BlueprintSection;
}): number {
  if (section.minutes && section.questions) {
    return Math.max(1, Math.round((section.minutes * picked) / section.questions));
  }

  return Math.max(1, Math.round(picked * pace));
}

/** One skill after another, so a section mixes the area's skills instead of repeating one. */
function interleaveBySkill(candidates: readonly MockCandidate[]): MockCandidate[] {
  return interleave([...Map.groupBy(candidates, (candidate) => candidate.skillId).values()]);
}

function matchesSection(candidate: MockCandidate, section: BlueprintSection): boolean {
  return Boolean(candidate.area && section.name && namesMatch(candidate.area, section.name));
}

/**
 * A section's own area questions first, then those no section of the exam claims on any day, so a
 * day-two mock never borrows day one's areas.
 */
function sectionPool({
  allSections,
  candidates,
  section,
}: {
  allSections: readonly BlueprintSection[];
  candidates: readonly MockCandidate[];
  section: BlueprintSection;
}): MockCandidate[] {
  const own = candidates.filter((candidate) => matchesSection(candidate, section));

  const unclaimed = candidates.filter(
    (candidate) => !allSections.some((other) => matchesSection(candidate, other)),
  );

  return interleaveBySkill([...own, ...unclaimed]);
}

function byDifficulty(first: MockCandidate, second: MockCandidate): number {
  return (first.difficulty ?? 0) - (second.difficulty ?? 0);
}

/** A module's name without its number: "Math, module 2" is "Math, module". */
function withoutNumbers(name: string): string {
  return name.replaceAll(/\d+/gu, " ");
}

/** Two names for the same subject's modules ("Math, module 1" and "Math, module 2"). */
function isNextModule({ current, previous }: { current: string | null; previous: string | null }) {
  return Boolean(
    current &&
    previous &&
    current !== previous &&
    namesMatch(withoutNumbers(current), withoutNumbers(previous)),
  );
}

function toRouting({ pool, wanted }: { pool: MockCandidate[]; wanted: number }): MockRouting {
  const sorted = pool.toSorted(byDifficulty);

  return {
    easier: sorted.slice(0, wanted).map((item) => item.itemId),
    harder: sorted
      .toReversed()
      .slice(0, wanted)
      .map((item) => item.itemId),
  };
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
  fullLength,
  mockNumber,
  structure,
}: {
  adaptive: boolean;
  candidates: readonly MockCandidate[];
  fullLength: boolean;
  /** How many mocks the learner already finished for the goal: the days take turns. */
  mockNumber: number;
  structure: ExamStructure | null;
}): MockPlan {
  const days = getDays(structure);
  const day = days[mockNumber % days.length] ?? null;
  const sections = getDaySections({ day, structure });
  const pace = getPace(structure);
  const share = fullLength ? 1 : WEEKLY_MOCK_SHARE;

  const planned = sections.reduce<{ plans: MockSectionPlan[]; used: Set<string> }>(
    (state, section, index) => {
      const wanted = Math.ceil((section.questions ?? DEFAULT_SECTION_QUESTIONS) * share);

      const pool = sectionPool({
        allSections: structure?.mock?.sections ?? sections,
        candidates,
        section,
      }).filter((candidate) => !state.used.has(candidate.itemId));

      const previous = sections[index - 1]?.name ?? null;
      const routed = adaptive && isNextModule({ current: section.name, previous });
      const routing = routed ? toRouting({ pool, wanted }) : null;
      const picked = routing ? [] : pool.slice(0, wanted).map((item) => item.itemId);
      const reserved = routing ? [...routing.easier, ...routing.harder] : picked;
      const questions = routing ? Math.min(wanted, routing.easier.length) : picked.length;

      const plan: MockSectionPlan = {
        itemIds: picked,
        minutes: sectionMinutes({ pace, picked: questions, section }),
        name: section.name,
        questions,
        routing,
      };

      return { plans: [...state.plans, plan], used: new Set([...state.used, ...reserved]) };
    },
    { plans: [], used: new Set() },
  );

  const plans = planned.plans.filter((plan) => plan.questions > 0);

  return {
    day,
    fullLength,
    minutes: plans.reduce((sum, plan) => sum + plan.minutes, 0),
    sections: plans,
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
  fullLength,
  structure,
}: {
  day?: number | null;
  fullLength: boolean;
  structure: ExamStructure | null;
}): MockPlan {
  const day = requestedDay === undefined ? (getDays(structure)[0] ?? null) : requestedDay;
  const pace = getPace(structure);
  const share = fullLength ? 1 : WEEKLY_MOCK_SHARE;

  const sections = getDaySections({ day, structure }).map((section) => {
    const questions = Math.ceil((section.questions ?? DEFAULT_SECTION_QUESTIONS) * share);

    return {
      itemIds: [],
      minutes: sectionMinutes({ pace, picked: questions, section }),
      name: section.name,
      questions,
      routing: null,
    };
  });

  return {
    day,
    fullLength,
    minutes: sections.reduce((sum, section) => sum + section.minutes, 0),
    sections,
  };
}

/** How long the goal's weekly mock takes on regular weeks, for the plan to reserve the day. */
export function getWeeklyMockMinutes({
  fullLength,
  structure,
}: {
  fullLength: boolean;
  structure: ExamStructure | null;
}): number {
  return outlineMock({ fullLength, structure }).minutes;
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

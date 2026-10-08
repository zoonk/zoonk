import { interleave } from "@zoonk/utils/interleave";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { namesMatch } from "../_utils/name-match";
import { type MockRouting, isNextModule, toRouting } from "./mock-routing";

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

/** One of the notice's subjects, by the name questions' areas carry, and its questions. */
export type SubjectShare = { name: string; questions: number };

/** A bank item a mock can ask: its area (the plan graph's), and how hard it is. */
export type MockCandidate = {
  area: string | null;
  difficulty: number | null;
  itemId: string;
  skillId: string;
};

type MockSectionPlan = {
  itemIds: string[];
  minutes: number;
  /** The blueprint's section name, or null for an exam that doesn't name its sections. */
  name: string | null;
  questions: number;
  routing: MockRouting | null;
};

/** What a written part asks, as the notice states it; `count` is null when it's in the words. */
type MockWrittenTask = { count: number | null; description: string };

/**
 * A part of the exam day answered in writing (a discursive test, a redação, a peça técnica): the
 * mock lists it as the notice states it, never as objective questions.
 */
export type MockWrittenPart = { minutes: number | null; name: string; tasks: MockWrittenTask[] };

export type MockPlan = {
  /** Which exam day the mock copies, when the exam runs over several days. */
  day: number | null;
  fullLength: boolean;
  minutes: number;
  sections: MockSectionPlan[];
  /** The day's written parts, in a full-length mock; a short one sits half the objective part. */
  written: MockWrittenPart[];
};

type BlueprintSection = { minutes: number | null; name: string | null; questions: number | null };

type StructureSection = NonNullable<ExamStructure["mock"]>["sections"][number];

/** How a written test is named, for readings from before sections had kinds. */
const WRITTEN_SECTION_NAME =
  /discursiv|reda[cç][aã]o|pe[cç]a t[eé]cnica|essay|written|free.?response|escrit/iu;

/**
 * Whether a section is answered in writing: as its reading says, or, for a reading from before
 * sections had kinds, a section without a question count, named like a written test, in an exam
 * with an essay format.
 */
export function isWrittenSection({
  section,
  structure,
}: {
  section: StructureSection;
  structure: ExamStructure | null;
}): boolean {
  if (section.kind) {
    return section.kind === "written";
  }

  const hasEssay = structure?.formats.some((format) => format.kind === "essay") ?? false;
  return section.questions === null && hasEssay && WRITTEN_SECTION_NAME.test(section.name);
}

function toWrittenPart({
  section,
  structure,
}: {
  section: StructureSection;
  structure: ExamStructure | null;
}): MockWrittenPart {
  const essays = (structure?.formats ?? []).filter((format) => format.kind === "essay");

  const tasks =
    section.tasks && section.tasks.length > 0
      ? section.tasks
      : essays.map((format) => ({ count: null, description: format.description }));

  return { minutes: section.minutes, name: section.name, tasks };
}

/** The objective sections of the exam: the ones a mock fills with questions. */
function getObjectiveSections(structure: ExamStructure | null): StructureSection[] {
  return (structure?.mock?.sections ?? []).filter(
    (section) => !isWrittenSection({ section, structure }),
  );
}

/** A full-length mock lists the day's written parts; a short one leaves them for another week. */
function getDayWritten({
  day,
  fullLength,
  structure,
}: {
  day: number | null;
  fullLength: boolean;
  structure: ExamStructure | null;
}): MockWrittenPart[] {
  if (!fullLength) {
    return [];
  }

  return (structure?.mock?.sections ?? [])
    .filter((section) => section.day === day && isWrittenSection({ section, structure }))
    .map((section) => toWrittenPart({ section, structure }));
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

function getDaySections({
  day,
  structure,
}: {
  day: number | null;
  structure: ExamStructure | null;
}): BlueprintSection[] {
  const sections = (structure?.mock?.sections ?? []).filter((section) => section.day === day);

  // A day of only a written test has no questions to pick.
  if (sections.length > 0) {
    return sections.filter((section) => !isWrittenSection({ section, structure }));
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
 * Whether the questions' areas line up with the exam's sections: some question's area is named by
 * a section. When none is (a goal without areas, or sections that don't name areas), sections
 * can't be told apart by area.
 */
function areasMatchSections({
  allSections,
  candidates,
}: {
  allSections: readonly BlueprintSection[];
  candidates: readonly MockCandidate[];
}): boolean {
  return candidates.some((candidate) =>
    allSections.some((section) => matchesSection(candidate, section)),
  );
}

/**
 * The questions a section may ask. When areas line up with sections, only the section's own area:
 * "Natural Sciences and Math" never asks an English reading question, and a question whose area
 * no section names stays out. When they don't line up, any question may fill any section.
 */
function sectionPool({
  byArea,
  candidates,
  section,
}: {
  byArea: boolean;
  candidates: readonly MockCandidate[];
  section: BlueprintSection;
}): MockCandidate[] {
  return interleaveBySkill(
    byArea ? candidates.filter((candidate) => matchesSection(candidate, section)) : candidates,
  );
}

/**
 * A section's name says which area it asks. Questions that couldn't be sorted by area fill an
 * exam's several sections without their names, so none claims an area it may not ask.
 */
function getSectionName({
  allSections,
  byArea,
  section,
}: {
  allSections: readonly BlueprintSection[];
  byArea: boolean;
  section: BlueprintSection;
}): string | null {
  return byArea || allSections.length <= 1 ? section.name : null;
}

/**
 * A section that asks several of the notice's subjects asks each its share, in the notice's order,
 * as ENEM's first day asks 45 questions of Linguagens, then 45 of Ciências Humanas. A subject short
 * of questions leaves its place to the others. Questions whose areas aren't those subjects stay as
 * they came.
 */
function orderBySubjectShares({
  pool,
  subjectShares,
  wanted,
}: {
  pool: readonly MockCandidate[];
  subjectShares: readonly SubjectShare[];
  wanted: number;
}): MockCandidate[] {
  const ofSubject = (name: string) => (candidate: MockCandidate) =>
    candidate.area !== null && namesMatch(candidate.area, name);

  const shares = subjectShares.filter((share) => pool.some((item) => ofSubject(share.name)(item)));

  if (shares.length < 2) {
    return [...pool];
  }

  const total = shares.reduce((sum, share) => sum + share.questions, 0);

  const shared = shares.flatMap((share) =>
    pool
      .filter((item) => ofSubject(share.name)(item))
      .slice(0, Math.round((wanted * share.questions) / total)),
  );

  // A subject named inside another's ("Direito Civil", "Direito Processual Civil") matches its
  // questions too: each question still comes once.
  const first = [...new Map(shared.map((candidate) => [candidate.itemId, candidate])).values()];
  const picked = new Set(first.map((candidate) => candidate.itemId));
  return [...first, ...pool.filter((candidate) => !picked.has(candidate.itemId))];
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
  subjectShares = [],
}: {
  adaptive: boolean;
  candidates: readonly MockCandidate[];
  fullLength: boolean;
  /** How many mocks the learner already finished for the goal: the days take turns. */
  mockNumber: number;
  structure: ExamStructure | null;
  /** The notice's subjects with their questions, so a section asks each its share. */
  subjectShares?: readonly SubjectShare[];
}): MockPlan {
  const days = getMockDays(structure);
  const day = days[mockNumber % days.length] ?? null;
  const sections = getDaySections({ day, structure });
  const pace = getPace(structure);
  const share = fullLength ? 1 : WEEKLY_MOCK_SHARE;
  const objective = getObjectiveSections(structure);
  const allSections = objective.length > 0 ? objective : sections;
  const byArea = areasMatchSections({ allSections, candidates });

  const planned = sections.reduce<{ plans: MockSectionPlan[]; used: Set<string> }>(
    (state, section, index) => {
      const wanted = Math.ceil((section.questions ?? DEFAULT_SECTION_QUESTIONS) * share);

      const pool = orderBySubjectShares({
        pool: sectionPool({ byArea, candidates, section }).filter(
          (candidate) => !state.used.has(candidate.itemId),
        ),
        subjectShares,
        wanted,
      });

      const previous = sections[index - 1]?.name ?? null;
      const routed = adaptive && isNextModule({ current: section.name, previous });
      const routing = routed ? toRouting({ pool, wanted }) : null;
      const picked = routing ? [] : pool.slice(0, wanted).map((item) => item.itemId);
      const reserved = routing ? [...routing.easier, ...routing.harder] : picked;
      const questions = routing ? Math.min(wanted, routing.easier.length) : picked.length;

      const plan: MockSectionPlan = {
        itemIds: picked,
        minutes: sectionMinutes({ pace, picked: questions, section }),
        name: getSectionName({ allSections, byArea, section }),
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
    written: getDayWritten({ day, fullLength, structure }),
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
  const day = requestedDay === undefined ? (getMockDays(structure)[0] ?? null) : requestedDay;
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
    written: getDayWritten({ day, fullLength, structure }),
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

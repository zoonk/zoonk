import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getSubjectQuestions } from "../../library/exams/subject-questions";
import { matchAreasToSubjects } from "../../view-models/syllabus/_utils/match-areas";
import { namesMatch } from "../_utils/name-match";
import { type MockOptionView, type MockShape } from "./mock-contract";
import { type MockTypedPart, listCoveredSections, listMockLeftOut } from "./mock-left-out";
import { getMockDays, outlineMock } from "./mock-plan";
import { type SubjectShare } from "./mock-subject-shares";
import { findSubjectSections, getObjectiveSectionNames, getSubjectPace } from "./subject-sections";
import { type MockEssayCandidate, getDayWrittenParts } from "./written-parts";
import { isObjectiveSection, isQuestionSubject } from "./written-subject";

/** A subject's mock asks this many when nothing says how many questions the exam has. */
const DEFAULT_SUBJECT_QUESTIONS = 20;

/**
 * Fewer questions than this and a subject's mock says too little to be worth the time, so a
 * subject the exam asks less of (the OAB's 2 of 80 for Direitos Humanos) gets this many: every
 * subject the plan studies has its mock.
 */
const MIN_SUBJECT_QUESTIONS = 5;

/**
 * About how long a mock of this many questions takes: at learners' real pace on the exam's mocks
 * (`pace`, minutes per question), never longer than the exam's own time for it (`minutes`, which
 * its clock gives); the exam's own time until learners' pace is known.
 */
export function estimateMockMinutes({
  minutes,
  pace,
  questions,
}: {
  minutes: number;
  pace: number | null;
  questions: number;
}): number {
  return pace === null ? minutes : Math.min(minutes, Math.max(1, Math.round(questions * pace)));
}

/**
 * A mock the learner can take whenever they want, with its honest size: the questions it asks and
 * the minutes it gives at the exam's pace.
 */
export type MockOption = MockOptionView;

type Subject = ExamStructure["subjects"][number];

/**
 * The notice subject a plan area teaches, as every screen matches them (`matchAreasToSubjects`): a
 * plan built before the notice was read names its areas the way learners do ("Statute of the Child
 * and Adolescent" for the notice's "Child and Adolescent Law", "Professional Ethics"
 * for the OAB's "Statute of the Legal Profession and of the OAB…").
 */
export function findAreaSubject({
  area,
  structure,
}: {
  area: string;
  structure: ExamStructure | null;
}): Subject | undefined {
  const subjects = structure?.subjects ?? [];
  const index = matchAreasToSubjects({ areas: [area], subjects }).get(area);

  return index === undefined ? undefined : subjects[index];
}

/**
 * Whether a plan area is one the option asks. Options name a notice subject by the notice's name,
 * and an area asks for the subject it teaches (`findAreaSubject`); a plan of its own areas, which
 * the notice doesn't name, by the area's own name.
 */
export function isOptionArea({
  area,
  option,
  structure,
}: {
  area: string;
  /** A diagnostic mock's options have no single subject (`area`). */
  option: { area?: string | null; areas: readonly string[] };
  structure: ExamStructure | null;
}): boolean {
  const named = [option.area ?? null, ...option.areas].filter((name) => name !== null);
  const subject = findAreaSubject({ area, structure });

  if (subject) {
    return named.includes(subject.name);
  }

  return named.some((name) => namesMatch(area, name));
}

/**
 * The notice's objective subjects with their questions, under the names mock questions' areas
 * carry (see `toSubjectCandidates`), so an exam day's section asks each its share, as a block of
 * its own in the notice's order. A notice that counts none of them (and no past edition does)
 * gets them in equal shares, so every subject is asked, never only the first ones. An option the
 * learner picked that's counted inside another subject (`partOf`) and has no count of its own
 * takes its part of that subject's share (see `splitPartShares`).
 */
export function getSubjectShares(structure: ExamStructure | null): SubjectShare[] {
  const objective = (structure?.subjects ?? []).filter(
    (subject) => structure && isQuestionSubject({ structure, subject }),
  );

  const shares = objective.map((subject) => {
    const whole = objective.find((other) => other.name === subject.partOf);

    return {
      name: subject.name,
      partOf: whole ? whole.name : null,
      questions: structure ? getSubjectQuestions({ structure, subject }) || null : null,
    };
  });

  const counted = shares.some((share) => share.questions !== null);

  return shares.flatMap((share) => {
    if (share.questions !== null || share.partOf) {
      return [share];
    }

    return counted ? [] : [{ ...share, even: true, questions: 1 }];
  });
}

/**
 * The notice's subjects a mock can ask: its objective ones the plan studies, whatever name the
 * plan's area gives the subject (`findAreaSubject`), in the notice's order.
 */
export function getObjectiveSubjects({
  goalAreas,
  structure,
}: {
  goalAreas: readonly string[];
  structure: ExamStructure;
}): Subject[] {
  const studied = new Set(goalAreas.map((area) => findAreaSubject({ area, structure })));

  return structure.subjects.filter(
    (subject) => studied.has(subject) && isQuestionSubject({ structure, subject }),
  );
}

/** The day's objective sections: the ones the mock fills with questions. */
function getDayObjectiveSections({
  day,
  structure,
}: {
  day: number | null;
  structure: ExamStructure | null;
}) {
  return (structure?.mock?.sections ?? []).filter(
    (section) => section.day === day && isObjectiveSection(section),
  );
}

/**
 * Whether a subject is a picked option the notice counts inside another of `subjects` (the foreign
 * language a candidate takes, inside ENEM's languages area): a mock asks it as part of that
 * subject and names it by it, never on its own.
 */
function isPartOfAnother({
  subject,
  subjects,
}: {
  subject: Subject;
  subjects: readonly Subject[];
}): boolean {
  return Boolean(subject.partOf) && subjects.some((other) => other.name === subject.partOf);
}

/**
 * The subjects an exam day asks, as its sections name them, even in part (see
 * `findSubjectSections`); every one for an exam of one day. An option counted inside another
 * subject goes by that subject's name.
 */
function getDayAreas({
  day,
  subjects,
  structure,
}: {
  day: number | null;
  subjects: readonly Subject[];
  structure: ExamStructure | null;
}): string[] {
  const objective = getDayObjectiveSections({ day, structure });
  const named = objective.map((section) => section.name).filter((name) => name.trim().length > 0);
  const sections = getObjectiveSectionNames(structure);

  const asked =
    getMockDays(structure).length > 1 && named.length > 0
      ? subjects.filter((subject) =>
          findSubjectSections({ sections, subject }).some((section) => named.includes(section)),
        )
      : subjects;

  return asked
    .filter((subject) => !isPartOfAnother({ subject, subjects }))
    .map((subject) => subject.name);
}

/**
 * An exam day's mock: in full, with the day's written parts the exam has essays for (see
 * `placeWrittenParts`), or half of its objective part. `objectiveOnly` says the day has a written
 * part the mock leaves out.
 */
function toDayOption({
  day,
  essays,
  kind,
  listening,
  speaking,
  subjects,
  structure,
  typed,
}: {
  day: number | null;
  essays: readonly MockEssayCandidate[];
  kind: "full" | "half";
  /** The listening sections that have recordings to play, by name. */
  listening: ReadonlySet<string>;
  /** The goal's exam has a speaking paper, which a full mock sits. */
  speaking: boolean;
  subjects: readonly Subject[];
  structure: ExamStructure | null;
  typed: readonly MockTypedPart[];
}): MockOption {
  const outline = outlineMock({
    day,
    essays,
    fullLength: kind === "full",
    listening,
    speaking,
    structure,
  });

  const running = new Set(
    outline.sections.flatMap((section) => (section.kind && section.name ? [section.name] : [])),
  );

  const parts = getDayWrittenParts({ day, structure });
  const asked = outline.written.filter((part) => part.asked).map((part) => part.name);
  const leftOut = listMockLeftOut({ asked, day, kind, running, structure, typed });

  return {
    area: null,
    areas: getDayAreas({ day, structure, subjects }),
    covers: listCoveredSections({ asked, day, leftOut, structure }),
    day,
    estimatedMinutes: outline.minutes,
    kind,
    leftOut,
    minutes: outline.minutes,
    objectiveOnly: asked.length < parts.length,
    questions: outline.sections.reduce((sum, section) => sum + section.questions, 0),
    written: asked,
  };
}

/**
 * A subject's even share of the exam's objective questions, as a full mock asks it when nothing
 * counts the subjects (see `getSubjectShares`): the Câmara's 180 over nine subjects is 20 each.
 */
function getEvenSubjectQuestions(structure: ExamStructure): number | null {
  const subjects = structure.subjects.filter((subject) =>
    isQuestionSubject({ structure, subject }),
  );

  const sections = (structure.mock?.sections ?? [])
    .filter((section) => isObjectiveSection(section))
    .reduce((sum, section) => sum + (section.questions ?? 0), 0);

  const total = sections || structure.mock?.totalQuestions;
  return total && subjects.length > 0 ? Math.round(total / subjects.length) : null;
}

/**
 * A subject's own mock, with the options counted inside it (`parts`): their questions join its
 * count, as the notice counts them, and its mock asks them (see `planOptionMock`).
 */
function toSubjectOption({
  parts,
  subject,
  structure,
  typed,
}: {
  parts: readonly Subject[];
  subject: Subject;
  structure: ExamStructure;
  typed: readonly MockTypedPart[];
}): MockOption {
  const partQuestions = parts.reduce(
    (sum, part) => sum + (getSubjectQuestions({ structure, subject: part }) ?? 0),
    0,
  );

  const questions = Math.max(
    (getSubjectQuestions({ structure, subject }) ??
      getEvenSubjectQuestions(structure) ??
      DEFAULT_SUBJECT_QUESTIONS) + partQuestions,
    MIN_SUBJECT_QUESTIONS,
  );

  const minutes = Math.max(1, Math.round(questions * getSubjectPace({ structure, subject })));

  return {
    area: subject.name,
    areas: [subject.name, ...parts.map((part) => part.name)],
    covers: null,
    day: null,
    estimatedMinutes: minutes,
    kind: "area",
    leftOut: listMockLeftOut({ asked: [], day: null, kind: "area", structure, typed }),
    minutes,
    objectiveOnly: false,
    questions,
    written: [],
  };
}

/**
 * The mocks a learner can take whenever they want, in the exam's real format and time: each exam
 * day in full, half of the day whose turn it is (as the weekly mocks take turns), and each of the
 * notice's objective subjects on its own, the biggest first, each with about how long it takes at
 * learners' real pace (`pace`). An exam of one subject (or a class test) has no separate subject
 * mocks.
 */
export function listMockOptions({
  dayInTurn,
  essays = [],
  goalAreas,
  listening = new Set(),
  pace = null,
  speaking = false,
  structure,
  typed = [],
}: {
  /** The exam day the next weekly mock copies, which the half mock copies too. */
  dayInTurn: number | null;
  /** The exam's essays, which a full mock's written parts ask (see `loadMockEssays`). */
  essays?: readonly MockEssayCandidate[];
  /** The plan's areas, which the mock's questions come from. */
  goalAreas: readonly string[];
  /** The listening sections that have recordings to play, by name (see `planMock`). */
  listening?: ReadonlySet<string>;
  /** Learners' minutes per question on the exam's mocks (see `loadMockPace`), when known. */
  pace?: number | null;
  /** The goal's exam has a speaking paper, which a full mock sits (see `planMock`). */
  speaking?: boolean;
  structure: ExamStructure | null;
  /** The exam's typed formats its bank asks (see `loadBankTypedParts`). */
  typed?: readonly MockTypedPart[];
}): MockOption[] {
  const subjects = structure ? getObjectiveSubjects({ goalAreas, structure }) : [];
  const days = getMockDays(structure);
  const halfDay = days.includes(dayInTurn) ? dayInTurn : (days[0] ?? null);

  const full = days.map((day) =>
    toDayOption({ day, essays, kind: "full", listening, speaking, structure, subjects, typed }),
  );

  const half = toDayOption({
    day: halfDay,
    essays,
    kind: "half",
    listening,
    speaking,
    structure,
    subjects,
    typed,
  });

  const wholes = subjects.filter((subject) => !isPartOfAnother({ subject, subjects }));

  const bySubject =
    structure && wholes.length > 1
      ? wholes
          .map((subject) =>
            toSubjectOption({
              parts: subjects.filter((part) => part.partOf === subject.name),
              structure,
              subject,
              typed,
            }),
          )
          .toSorted((first, second) => second.questions - first.questions)
      : [];

  return (
    [...full, half, ...bySubject]
      // A day that is all written (the OAB's second phase) is a mock once the exam has its essays.
      .filter((option) => option.questions > 0 || option.written.length > 0)
      .map((option) => ({ ...option, estimatedMinutes: estimateMockMinutes({ ...option, pace }) }))
  );
}

/** The option a learner picked, as the options list it now; null when it isn't one of them. */
export function findMockOption({
  options,
  shape,
}: {
  options: readonly MockOption[];
  shape: MockShape;
}): MockOption | null {
  return (
    options.find(
      (option) =>
        option.kind === shape.kind &&
        option.day === shape.day &&
        (option.area ?? null) === (shape.area ?? null),
    ) ?? null
  );
}

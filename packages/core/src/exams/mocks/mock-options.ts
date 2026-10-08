import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getSubjectQuestions } from "../../library/exams/subject-questions";
import { namesMatch } from "../_utils/name-match";
import { type MockOptionView, type MockShape } from "./mock-contract";
import {
  type SubjectShare,
  getMockDays,
  getPace,
  isWrittenSection,
  outlineMock,
} from "./mock-plan";
import { isWrittenSubject } from "./written-subject";

/** A subject's mock asks this many when neither the notice nor a past edition counts its questions. */
const DEFAULT_SUBJECT_QUESTIONS = 20;

/** Fewer questions than this and a subject's mock says too little to be worth the time. */
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

export function subjectName(subject: Subject): string {
  return subject.shortName ?? subject.name;
}

/**
 * Whether a plan area is one the option asks. Options name a notice subject by its short name
 * ("Ética Profissional"), while the plan names its area by the notice's full one ("Estatuto da
 * Advocacia e da OAB…"), which shares too few words with it to match: either of a subject's names
 * counts.
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

  const fullNames = (structure?.subjects ?? [])
    .filter((subject) => named.includes(subjectName(subject)))
    .map((subject) => subject.name);

  return [...named, ...fullNames].some((name) => namesMatch(area, name));
}

/**
 * The notice's objective subjects with their questions, under the names mock questions' areas
 * carry (see `toSubjectCandidates`), so an exam day's section asks each its share.
 */
export function getSubjectShares(structure: ExamStructure | null): SubjectShare[] {
  return (structure?.subjects ?? []).flatMap((subject) => {
    if (!structure || isWrittenSubject({ structure, subject })) {
      return [];
    }

    const questions = getSubjectQuestions({ structure, subject });
    return questions ? [{ name: subjectName(subject), questions }] : [];
  });
}

/** The notice's subjects a mock can ask: its objective ones the goal has questions on. */
export function getObjectiveSubjects({
  goalAreas,
  structure,
}: {
  goalAreas: readonly string[];
  structure: ExamStructure;
}): Subject[] {
  return structure.subjects.filter(
    (subject) =>
      !isWrittenSubject({ structure, subject }) &&
      goalAreas.some(
        (area) => namesMatch(area, subject.name) || namesMatch(area, subjectName(subject)),
      ),
  );
}

/** The day's sections, the written ones apart: the mock asks the rest. */
function getDayParts({ day, structure }: { day: number | null; structure: ExamStructure | null }) {
  const sections = (structure?.mock?.sections ?? []).filter((section) => section.day === day);
  const written = sections.filter((section) => isWrittenSection({ section, structure }));

  return { objective: sections.filter((section) => !written.includes(section)), written };
}

/**
 * Whether the exam day also has a part answered in writing, which the mock leaves out: a written
 * section of its own, or a written subject (a redação) its sections name, as ENEM's first day
 * does ("Linguagens, Ciências Humanas e redação").
 */
function hasWrittenPart({
  day,
  structure,
}: {
  day: number | null;
  structure: ExamStructure | null;
}): boolean {
  const { objective, written } = getDayParts({ day, structure });

  const writtenSubjects = (structure?.subjects ?? []).filter(
    (subject) => structure && isWrittenSubject({ structure, subject }),
  );

  return (
    written.length > 0 ||
    writtenSubjects.some((subject) =>
      objective.some((section) => namesMatch(subject.name, section.name)),
    )
  );
}

/** The subjects an exam day asks, as its sections name them; every one for an exam of one day. */
function getDayAreas({
  day,
  subjects,
  structure,
}: {
  day: number | null;
  subjects: readonly Subject[];
  structure: ExamStructure | null;
}): string[] {
  const { objective } = getDayParts({ day, structure });
  const named = objective.filter((section) => section.name.trim().length > 0);

  const asked =
    getMockDays(structure).length > 1 && named.length > 0
      ? subjects.filter((subject) =>
          named.some((section) => namesMatch(subjectName(subject), section.name)),
        )
      : subjects;

  return asked.map((subject) => subjectName(subject));
}

function toDayOption({
  day,
  kind,
  subjects,
  structure,
}: {
  day: number | null;
  kind: "full" | "half";
  subjects: readonly Subject[];
  structure: ExamStructure | null;
}): MockOption {
  const outline = outlineMock({ day, fullLength: kind === "full", structure });

  return {
    area: null,
    areas: getDayAreas({ day, structure, subjects }),
    day,
    estimatedMinutes: outline.minutes,
    kind,
    minutes: outline.minutes,
    objectiveOnly: hasWrittenPart({ day, structure }),
    questions: outline.sections.reduce((sum, section) => sum + section.questions, 0),
  };
}

/**
 * Minutes per question in a subject: its exam day's pace when a day's section names it, else the
 * exam's pace across its objective sections.
 */
export function getSubjectPace({
  subject,
  structure,
}: {
  subject: Subject;
  structure: ExamStructure;
}): number {
  const objective = (structure.mock?.sections ?? []).filter(
    (section) => !isWrittenSection({ section, structure }) && section.minutes && section.questions,
  );

  const own = objective.find((section) => namesMatch(subjectName(subject), section.name));
  const paced = own ? [own] : objective;
  const minutes = paced.reduce((sum, section) => sum + (section.minutes ?? 0), 0);
  const questions = paced.reduce((sum, section) => sum + (section.questions ?? 0), 0);

  return questions > 0 ? minutes / questions : getPace(structure);
}

function toSubjectOption({
  subject,
  structure,
}: {
  subject: Subject;
  structure: ExamStructure;
}): MockOption | null {
  const questions = getSubjectQuestions({ structure, subject }) ?? DEFAULT_SUBJECT_QUESTIONS;

  if (questions < MIN_SUBJECT_QUESTIONS) {
    return null;
  }

  const minutes = Math.max(1, Math.round(questions * getSubjectPace({ structure, subject })));

  return {
    area: subject.name,
    areas: [subjectName(subject)],
    day: null,
    estimatedMinutes: minutes,
    kind: "area",
    minutes,
    objectiveOnly: false,
    questions,
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
  goalAreas,
  pace = null,
  structure,
}: {
  /** The exam day the next weekly mock copies, which the half mock copies too. */
  dayInTurn: number | null;
  /** The plan's areas, which the mock's questions come from. */
  goalAreas: readonly string[];
  /** Learners' minutes per question on the exam's mocks (see `loadMockPace`), when known. */
  pace?: number | null;
  structure: ExamStructure | null;
}): MockOption[] {
  const subjects = structure ? getObjectiveSubjects({ goalAreas, structure }) : [];
  const days = getMockDays(structure);
  const halfDay = days.includes(dayInTurn) ? dayInTurn : (days[0] ?? null);

  const full = days.map((day) => toDayOption({ day, kind: "full", structure, subjects }));
  const half = toDayOption({ day: halfDay, kind: "half", structure, subjects });

  const bySubject =
    structure && subjects.length > 1
      ? subjects
          .map((subject) => toSubjectOption({ structure, subject }))
          .filter((option) => option !== null)
          .toSorted((first, second) => second.questions - first.questions)
      : [];

  return [...full, half, ...bySubject]
    .filter((option) => option.questions > 0)
    .map((option) => ({ ...option, estimatedMinutes: estimateMockMinutes({ ...option, pace }) }));
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

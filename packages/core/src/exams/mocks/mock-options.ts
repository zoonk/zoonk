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

const DEFAULT_SUBJECT_QUESTIONS = 20;

const MIN_SUBJECT_QUESTIONS = 5;

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

export type MockOption = MockOptionView;

type Subject = ExamStructure["subjects"][number];

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

export function isOptionArea({
  area,
  option,
  structure,
}: {
  area: string;
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

function isPartOfAnother({
  subject,
  subjects,
}: {
  subject: Subject;
  subjects: readonly Subject[];
}): boolean {
  return Boolean(subject.partOf) && subjects.some((other) => other.name === subject.partOf);
}

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
  listening: ReadonlySet<string>;
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
  dayInTurn: number | null;
  essays?: readonly MockEssayCandidate[];
  goalAreas: readonly string[];
  listening?: ReadonlySet<string>;
  pace?: number | null;
  speaking?: boolean;
  structure: ExamStructure | null;
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

  return [...full, half, ...bySubject]
    .filter((option) => option.questions > 0 || option.written.length > 0)
    .map((option) => ({ ...option, estimatedMinutes: estimateMockMinutes({ ...option, pace }) }));
}

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

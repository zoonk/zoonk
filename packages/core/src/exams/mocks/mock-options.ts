import { matchAreasToSubjects } from "../../exams/_utils/match-areas";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getPartQuestions, getQuestionGroup } from "../../library/exams/question-group";
import { getPlannedSubjectQuestions } from "../../library/exams/subject-questions";
import { namesMatch } from "../_utils/name-match";
import { type MockOptionView, type MockShape } from "./mock-contract";
import { listDayOptions } from "./mock-day-options";
import { estimateMockMinutes } from "./mock-estimate";
import { type MockTypedPart, listMockLeftOut } from "./mock-left-out";
import { type SubjectShare } from "./mock-subject-shares";
import { type UnpickedChoice } from "./mock-unpicked";
import { countSubjectPaperQuestions, isPartOfAnother } from "./subject-paper-size";
import { getSubjectPace } from "./subject-sections";
import { isQuestionSubject } from "./written-subject";

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
    const group = structure ? getQuestionGroup({ structure, subject }) : null;

    return {
      group:
        group && structure && getPartQuestions({ name: group, structure }) !== null ? group : null,
      name: subject.name,
      partOf: whole ? whole.name : null,
      questions: structure ? getPlannedSubjectQuestions({ structure, subject }) || null : null,
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

function getObjectiveSubjects({
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

function toSubjectOption({
  pace,
  parts,
  subject,
  structure,
  typed,
}: {
  pace: number | null;
  parts: readonly Subject[];
  subject: Subject;
  structure: ExamStructure;
  typed: readonly MockTypedPart[];
}): MockOption {
  const questions = countSubjectPaperQuestions({ parts, structure, subject });

  const minutes = Math.max(1, Math.round(questions * getSubjectPace({ structure, subject })));

  return {
    area: subject.name,
    areas: [subject.name, ...parts.map((part) => part.name)],
    covers: null,
    day: null,
    estimatedMinutes: estimateMockMinutes({
      minutes,
      pace,
      questions,
      sections: [{ questions }],
      written: [],
    }),
    kind: "area",
    leftOut: listMockLeftOut({ asked: [], day: null, kind: "area", structure, typed }),
    minutes,
    objectiveOnly: true,
    questions,
    written: [],
  };
}

export function listMockOptions({
  goalAreas,
  listening = new Set(),
  pace = null,
  speaking = false,
  structure,
  typed = [],
  unpicked = [],
}: {
  goalAreas: readonly string[];
  listening?: ReadonlySet<string>;
  pace?: number | null;
  speaking?: boolean;
  structure: ExamStructure | null;
  typed?: readonly MockTypedPart[];
  unpicked?: readonly UnpickedChoice[];
}): MockOption[] {
  const subjects = structure ? getObjectiveSubjects({ goalAreas, structure }) : [];
  const days = listDayOptions({ listening, pace, speaking, structure, subjects, typed, unpicked });

  const wholes = subjects.filter((subject) => !isPartOfAnother({ subject, subjects }));

  const bySubject =
    structure && wholes.length > 1
      ? wholes
          .map((subject) =>
            toSubjectOption({
              pace,
              parts: subjects.filter((part) => part.partOf === subject.name),
              structure,
              subject,
              typed,
            }),
          )
          .toSorted((first, second) => second.questions - first.questions)
      : [];

  return [...days, ...bySubject].filter(
    (option) => option.questions > 0 || option.written.length > 0,
  );
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

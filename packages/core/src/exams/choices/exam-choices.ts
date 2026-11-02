import { z } from "zod";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getSubjectQuestions } from "../../library/exams/subject-questions";
import { matchAreasToSubjects } from "../../view-models/syllabus/_utils/match-areas";
import { listChoiceGroups } from "./choice-groups";
import { examChoicePickSchema } from "./exam-choice-contract";
import { scopeExamStructure } from "./exam-scope";

type Subject = ExamStructure["subjects"][number];

export type ExamChoice = z.infer<typeof examChoicePickSchema>;

/** Which of an exam's subjects the learner takes: the options they picked, within the subjects they prepare. */
export type ExamPicks = { examChoices: readonly ExamChoice[]; examSubjects: readonly string[] };

const storedPicksSchema = z.object({
  examChoices: z.array(examChoicePickSchema).default([]),
  examSubjects: z.array(z.string()).default([]),
});

export const NO_EXAM_PICKS: ExamPicks = { examChoices: [], examSubjects: [] };

export function readExamPicks(settings: unknown): ExamPicks {
  return storedPicksSchema.safeParse(settings).data ?? NO_EXAM_PICKS;
}

export function isSamePick(first: ExamChoice, second: ExamChoice): boolean {
  return (
    first.group === second.group &&
    first.subjects.length === second.subjects.length &&
    first.subjects.every((subject) => second.subjects.includes(subject))
  );
}

/** The options a pick names, in the notice's order; null unless it names one to `take` of its choice's options. */
export function findChosenOptions({
  choice,
  structure,
}: {
  choice: ExamChoice;
  structure: ExamStructure;
}): Subject[] | null {
  const group = listChoiceGroups(structure).find((item) => item.name === choice.group);
  const names = new Set(choice.subjects);
  const options = group?.options.filter((option) => names.has(option.name)) ?? [];

  return group && options.length > 0 && options.length === names.size && names.size <= group.take
    ? options
    : null;
}

function listUnchosenOptions({
  choices,
  structure,
}: {
  choices: readonly ExamChoice[];
  structure: ExamStructure;
}): Set<string> {
  const chosen = new Set(
    choices.flatMap((choice) =>
      (findChosenOptions({ choice, structure }) ?? []).map((option) => option.name),
    ),
  );

  return new Set(
    listChoiceGroups(structure).flatMap((group) =>
      group.options.flatMap((option) => (chosen.has(option.name) ? [] : [option.name])),
    ),
  );
}

/** The subjects the learner doesn't take: outside what they prepare, or options they didn't pick. */
export function listUnchosenSubjects({
  picks,
  structure,
}: {
  picks: ExamPicks;
  structure: ExamStructure;
}): Set<string> {
  const scoped = scopeExamStructure({ examSubjects: picks.examSubjects, structure });
  const kept = new Set(scoped.subjects.map((subject) => subject.name));
  const unchosen = listUnchosenOptions({ choices: picks.examChoices, structure: scoped });

  return new Set(
    structure.subjects.flatMap((subject) =>
      kept.has(subject.name) && !unchosen.has(subject.name) ? [] : [subject.name],
    ),
  );
}

export function findSubjectAreas({
  areas,
  names,
  structure,
}: {
  areas: readonly string[];
  names: ReadonlySet<string>;
  structure: ExamStructure;
}): Map<string, string> {
  if (names.size === 0) {
    return new Map();
  }

  const matches = matchAreasToSubjects({ areas, subjects: structure.subjects });

  return new Map(
    [...matches].flatMap(([area, index]) => {
      const name = structure.subjects[index]?.name;
      return name && names.has(name) ? [[area, name] as const] : [];
    }),
  );
}

export function findPartAreas({
  areas,
  structure,
}: {
  areas: readonly string[];
  structure: ExamStructure;
}): Map<string, string> {
  const matches = matchAreasToSubjects({ areas, subjects: structure.subjects });
  const subjectOf = (area: string) => structure.subjects[matches.get(area) ?? -1];

  return new Map(
    areas.flatMap((area) => {
      const partOf = subjectOf(area)?.partOf;
      const whole = partOf && areas.find((other) => subjectOf(other)?.name === partOf);
      return whole ? [[area, whole] as const] : [];
    }),
  );
}

function countChosenParts({
  chosen,
  structure,
  subject,
}: {
  chosen: readonly Subject[];
  structure: ExamStructure;
  subject: Subject;
}): number {
  return chosen
    .filter((option) => option.partOf === subject.name)
    .reduce(
      (total, option) => total + (getSubjectQuestions({ structure, subject: option }) ?? 0),
      0,
    );
}

export function toChosenStructure({
  picks,
  structure: whole,
}: {
  picks: ExamPicks;
  structure: ExamStructure;
}): ExamStructure {
  const structure = scopeExamStructure({ examSubjects: picks.examSubjects, structure: whole });

  if (listChoiceGroups(structure).length === 0) {
    return structure;
  }

  const unchosen = listUnchosenOptions({ choices: picks.examChoices, structure });
  const kept = structure.subjects.filter((subject) => !unchosen.has(subject.name));
  const chosen = kept.filter((subject) => subject.choiceGroup && subject.partOf);

  return {
    ...structure,
    subjects: kept.map((subject) => {
      const parts = countChosenParts({ chosen, structure, subject });

      return parts > 0 && subject.questions !== null
        ? { ...subject, questions: Math.max(0, subject.questions - parts) }
        : subject;
    }),
  };
}

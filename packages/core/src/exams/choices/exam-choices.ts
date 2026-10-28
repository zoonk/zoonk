import { z } from "zod";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getSubjectQuestions } from "../../library/exams/subject-questions";
import { matchAreasToSubjects } from "../../view-models/syllabus/_utils/match-areas";
import { type ExamChoiceView, examChoicePickSchema } from "./exam-choice-contract";

type Subject = ExamStructure["subjects"][number];

export type ExamChoice = z.infer<typeof examChoicePickSchema>;

const storedChoicesSchema = z.object({ examChoices: z.array(examChoicePickSchema).default([]) });

export function readExamChoices(settings: unknown): ExamChoice[] {
  return storedChoicesSchema.safeParse(settings).data?.examChoices ?? [];
}

export type ChoiceGroup<T extends Pick<Subject, "choiceGroup" | "name">> = {
  name: string;
  options: T[];
};

export function listChoiceGroups<T extends Pick<Subject, "choiceGroup" | "name">>(
  subjects: readonly T[],
): ChoiceGroup<T>[] {
  const names = [
    ...new Set(subjects.flatMap((item) => (item.choiceGroup ? [item.choiceGroup] : []))),
  ];

  return names
    .map((name) => ({ name, options: subjects.filter((item) => item.choiceGroup === name) }))
    .filter((group) => group.options.length > 1);
}

export function findChoiceOption({
  choice,
  structure,
}: {
  choice: ExamChoice;
  structure: ExamStructure;
}): Subject | null {
  const group = listChoiceGroups(structure.subjects).find((item) => item.name === choice.group);
  return group?.options.find((option) => option.name === choice.subject) ?? null;
}

export function listExamChoiceViews({
  choices,
  structure,
}: {
  choices: readonly ExamChoice[];
  structure: ExamStructure;
}): ExamChoiceView[] {
  return listChoiceGroups(structure.subjects).map((group) => {
    const choice = choices.find((item) => item.group === group.name);

    return {
      group: group.name,
      options: group.options.map((option) => ({
        name: option.name,
        shortName: option.shortName ?? null,
      })),
      subject: group.options.find((option) => option.name === choice?.subject)?.name ?? null,
    };
  });
}

export function listUnchosenSubjects({
  choices,
  structure,
}: {
  choices: readonly ExamChoice[];
  structure: ExamStructure;
}): Set<string> {
  const chosen = new Set(
    choices.flatMap((choice) => {
      const option = findChoiceOption({ choice, structure });
      return option ? [option.name] : [];
    }),
  );

  return new Set(
    listChoiceGroups(structure.subjects).flatMap((group) =>
      group.options.flatMap((option) => (chosen.has(option.name) ? [] : [option.name])),
    ),
  );
}

export function findOptionAreas({
  areas,
  structure,
}: {
  areas: readonly string[];
  structure: ExamStructure;
}): Map<string, string> {
  const options = new Set(
    listChoiceGroups(structure.subjects).flatMap((group) => group.options.map((item) => item.name)),
  );

  if (options.size === 0) {
    return new Map();
  }

  const matches = matchAreasToSubjects({ areas, subjects: structure.subjects });

  return new Map(
    [...matches].flatMap(([area, index]) => {
      const name = structure.subjects[index]?.name;
      return name && options.has(name) ? [[area, name] as const] : [];
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
  choices,
  structure,
}: {
  choices: readonly ExamChoice[];
  structure: ExamStructure;
}): ExamStructure {
  if (listChoiceGroups(structure.subjects).length === 0) {
    return structure;
  }

  const unchosen = listUnchosenSubjects({ choices, structure });
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

export function listCountedSubjects<T extends Pick<Subject, "choiceGroup" | "name" | "partOf">>(
  subjects: readonly T[],
): T[] {
  const choices = listChoiceGroups(subjects);
  const names = new Set(subjects.map((item) => item.name));

  return subjects.filter((item) => {
    if (item.partOf && names.has(item.partOf)) {
      return false;
    }

    const group = choices.find((choice) => choice.name === item.choiceGroup);
    return !group || group.options[0] === item;
  });
}

import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type ExamChoice } from "./exam-choices";

type Subject = ExamStructure["subjects"][number];

export type ChoiceGroup<T extends Pick<Subject, "choiceGroup" | "name">> = {
  name: string;
  options: T[];
  take: number;
};

type ChoiceSubjects<T> = Pick<ExamStructure, "choiceGroups"> & { subjects: readonly T[] };

export function listChoiceGroups<T extends Pick<Subject, "choiceGroup" | "name">>({
  choiceGroups,
  subjects,
}: ChoiceSubjects<T>): ChoiceGroup<T>[] {
  const names = [
    ...new Set(subjects.flatMap((item) => (item.choiceGroup ? [item.choiceGroup] : []))),
  ];

  return names
    .map((name) => ({
      name,
      options: subjects.filter((item) => item.choiceGroup === name),
      take: choiceGroups?.find((group) => group.name === name)?.take ?? 1,
    }))
    .filter((group) => group.options.length > group.take);
}

/** Every subject of the exam is one of the choice's options or part of one, so nothing is left to study without a pick. */
export function isRequiredChoice({
  group,
  structure,
}: {
  group: ChoiceGroup<Subject>;
  structure: ExamStructure;
}): boolean {
  const options = new Set(group.options.map((option) => option.name));

  return structure.subjects.every(
    (subject) => options.has(subject.name) || options.has(subject.partOf ?? ""),
  );
}

/** One place per subject of the exam, a choice's taking its first `take` options: what a candidate sits. */
export function listCountedSubjects<T extends Pick<Subject, "choiceGroup" | "name" | "partOf">>({
  choiceGroups,
  subjects,
}: ChoiceSubjects<T>): T[] {
  const choices = listChoiceGroups({ choiceGroups, subjects });
  const names = new Set(subjects.map((item) => item.name));

  return subjects.filter((item) => {
    if (item.partOf && names.has(item.partOf)) {
      return false;
    }

    const group = choices.find((choice) => choice.name === item.choiceGroup);
    return !group || group.options.slice(0, group.take).includes(item);
  });
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

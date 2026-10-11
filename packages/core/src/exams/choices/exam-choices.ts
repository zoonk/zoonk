import { z } from "zod";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getSubjectQuestions } from "../../library/exams/subject-questions";
import { matchAreasToSubjects } from "../../view-models/syllabus/_utils/match-areas";
import { type ExamChoiceView, examChoicePickSchema } from "./exam-choice-contract";

type Subject = ExamStructure["subjects"][number];

/** A learner's pick for one of their exam's choices: the option (a subject's name) they take. */
export type ExamChoice = z.infer<typeof examChoicePickSchema>;

const storedChoicesSchema = z.object({ examChoices: z.array(examChoicePickSchema).default([]) });

/** The learner's picks, as their plan's settings store them (`examChoices`); none when unread. */
export function readExamChoices(settings: unknown): ExamChoice[] {
  return storedChoicesSchema.safeParse(settings).data?.examChoices ?? [];
}

/** One of the exam's choices (ENEM's foreign language) and its options, in the notice's order. */
export type ChoiceGroup<T extends Pick<Subject, "choiceGroup" | "name">> = {
  name: string;
  options: T[];
};

/**
 * The exam's choices: the subjects that share a `choiceGroup`, in the notice's order. A choice the
 * reading kept a single option of isn't one: that subject is studied like any other.
 */
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

/** The option of a choice the learner picked, or null when the choice has no such option. */
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

/** Each of the exam's choices with its options and the one the learner picked, null until then. */
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

/**
 * The options the learner doesn't take: every option of a choice but the one they picked, and
 * every option of a choice they haven't picked yet (or picked an option the notice no longer
 * lists), so nothing of a choice is studied before they say which.
 */
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

/**
 * The skill graph's areas that teach an option of one of the exam's choices, each with the option
 * it teaches, matched as the syllabus matches areas to the notice's subjects.
 */
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

/**
 * The skill graph's areas that teach an option the notice counts inside another subject (ENEM's
 * foreign language, inside its languages area), each with the area that teaches that subject, the
 * first one in graph order: learners see the option as part of it, never as a subject of its own.
 */
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

/**
 * The questions the chosen options inside `subject` take from its count: the notice counts them
 * in it (the 45 questions of ENEM's languages area include the 5 of the language picked).
 */
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

/**
 * The exam as this learner takes it, for everything that weighs, counts or lists its subjects for
 * them (plan shares, mocks, the syllabus, the buddy): the options they don't take are gone, and a
 * picked option counted inside another subject takes its questions out of it, so each question
 * counts once. Without a pick a choice has no option here, and the subject it's part of keeps its
 * whole count.
 */
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

/**
 * The subjects whose questions add up to the exam's total: one option per choice (a candidate
 * answers one), and no option the notice counts inside another subject.
 */
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

import { toNameWords } from "@zoonk/utils/name-words";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { type listWrittenTasks } from "../../../library/exams/written-tasks";
import { namesMatch } from "../../_utils/name-match";
import { findChosenOptions, listChoiceGroups } from "../../choices/choice-groups";
import { type ExamPicks } from "../../choices/exam-choices";
import { type WritingNeedsChoice } from "../writing-contract";

type Subject = ExamStructure["subjects"][number];

type Task = Pick<
  ReturnType<typeof listWrittenTasks>[number],
  "description" | "section" | "subjects"
>;

export type WritingChoice = { group: string; subject: string };

/**
 * `choices` are the learner's options the task's questions can depend on: a prompt is shared only
 * by learners with the same options. `subjects` are the subjects its questions may be on.
 */
export type WritingScope = {
  available: boolean;
  choices: WritingChoice[];
  missingChoices: string[];
  subjects: Subject[];
};

export function writingNeedsChoice(groups: Iterable<string>): WritingNeedsChoice | undefined {
  const choiceGroups = [...new Set(groups)];
  return choiceGroups.length > 0 ? { choiceGroups, status: "needsChoice" } : undefined;
}

function findNamedSubjects({ structure, task }: { structure: ExamStructure; task: Task }) {
  return structure.subjects.filter(({ group, name, partOf }) =>
    [name, group, partOf].some(
      (label) => label && (namesMatch(label, task.section) || namesMatch(label, task.description)),
    ),
  );
}

function findNamedTaskGroups({ structure, task }: { structure: ExamStructure; task: Task }) {
  const words = new Set(toNameWords(task.description));

  return structure.subjects.filter(({ choiceGroup, group }) =>
    [choiceGroup, group].some((label) => {
      if (!label || namesMatch(label, task.section)) {
        return false;
      }

      // Notices often omit the paper code from the heading when describing the task.
      const heading = toNameWords(label.replace(/\s*\([A-Z]+\d+\)$/u, ""));
      return heading.length > 0 && heading.every((word) => words.has(word));
    }),
  );
}

export function getWritingScope({
  picks,
  structure,
  task,
}: {
  picks: ExamPicks;
  structure: ExamStructure;
  task: Task;
}): WritingScope {
  const { subjects: linked } = task;
  const groups = listChoiceGroups(structure);

  const named = linked
    ? structure.subjects.filter((subject) => linked.includes(subject.name))
    : findNamedTaskGroups({ structure, task });

  const scoped = linked || named.length > 0;
  const candidates = scoped ? named : findNamedSubjects({ structure, task });

  // An unlinked task that names no subject group can still depend on any choice in the exam.
  const relevant = scoped
    ? groups.filter((group) => group.options.some((option) => candidates.includes(option)))
    : groups;

  const choices = relevant.flatMap((group) => {
    const choice = picks.examChoices.find((pick) => pick.group === group.name);
    const options = choice ? findChosenOptions({ choice, structure }) : null;
    return (options ?? []).map((option) => ({ group: group.name, subject: option.name }));
  });

  const options = new Set(groups.flatMap((group) => group.options.map((option) => option.name)));
  const chosen = new Set(choices.map((choice) => choice.subject));

  const subjects = candidates.filter(
    (subject) => !options.has(subject.name) || chosen.has(subject.name),
  );

  const missing = relevant
    .filter(({ name }) => !choices.some(({ group }) => group === name))
    .map(({ name }) => name);

  const available = scoped
    ? subjects.length > 0 || (candidates.length === 0 && groups.length === 0)
    : missing.length === 0;

  return { available, choices, missingChoices: available ? [] : missing, subjects };
}

export function toChosenSubjects(choices: readonly WritingChoice[]): string[] {
  return choices.map((choice) => choice.subject).toSorted();
}

export function isSameWritingScope({
  choices,
  prompt,
}: {
  choices: readonly WritingChoice[];
  prompt: { chosenSubjects?: readonly string[] };
}): boolean {
  const own = toChosenSubjects(choices);
  const stored = prompt.chosenSubjects ?? [];
  return stored.length === own.length && stored.every((name, index) => name === own[index]);
}

/** The subject with topics that the scope's earlier prompts used least, so questions spread across them. */
export function pickWritingSubject({
  scope,
  used,
}: {
  scope: WritingScope;
  used: readonly (string | undefined)[];
}): { name: string; topics: string[] } | null {
  const counted = scope.subjects
    .filter((subject) => subject.topics.length > 0)
    .map((subject) => ({ count: used.filter((name) => name === subject.name).length, subject }));

  const fewest = Math.min(...counted.map(({ count }) => count));
  const picked = counted.find(({ count }) => count === fewest)?.subject;

  return picked ? { name: picked.name, topics: picked.topics } : null;
}

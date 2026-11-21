import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { type listWrittenTasks } from "../../../library/exams/written-tasks";
import { namesMatch } from "../../_utils/name-match";
import { listChoiceGroups } from "../../choices/choice-groups";
import { type ExamPicks, findChosenOptions } from "../../choices/exam-choices";

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
export type WritingScope = { choices: WritingChoice[]; subjects: Subject[] };

/** A blueprint read before its tasks recorded their subjects: the subjects named like the task. */
function findNamedSubjects({ structure, task }: { structure: ExamStructure; task: Task }) {
  return structure.subjects.filter(({ group, name, partOf }) =>
    [name, group, partOf].some(
      (label) => label && (namesMatch(label, task.section) || namesMatch(label, task.description)),
    ),
  );
}

/**
 * Without a recorded link, any choice of the exam may be the one the task is on, so every option
 * the learner picked scopes it and no prompt crosses options.
 */
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

  const candidates = linked
    ? structure.subjects.filter((subject) => linked.includes(subject.name))
    : findNamedSubjects({ structure, task });

  const choices = groups
    .filter((group) => !linked || group.options.some((option) => candidates.includes(option)))
    .flatMap((group) => {
      const choice = picks.examChoices.find((pick) => pick.group === group.name);
      const options = choice ? findChosenOptions({ choice, structure }) : null;
      return (options ?? []).map((option) => ({ group: group.name, subject: option.name }));
    });

  const options = new Set(groups.flatMap((group) => group.options.map((option) => option.name)));
  const chosen = new Set(choices.map((choice) => choice.subject));

  return {
    choices,
    subjects: candidates.filter(
      (subject) => !options.has(subject.name) || chosen.has(subject.name),
    ),
  };
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

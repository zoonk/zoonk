import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { listWrittenTasks } from "../../library/exams/written-tasks";
import { namesMatch } from "../_utils/name-match";
import { type MockSectionPlan } from "./mock-plan";

const PRACTICE_MINUTES_PER_ANSWER = 60;

type MockWrittenTask = ReturnType<typeof listWrittenTasks>[number];

export type MockWrittenPart = { minutes: number | null; name: string; tasks: MockWrittenTask[] };

export type MockDayWrittenPart = Omit<MockWrittenPart, "tasks"> & {
  asked: boolean;
  tasks: { count: number | null; description: string }[];
};

export type MockEssayCandidate = { itemId: string; taskKey: string };

type WrittenPlacement = { essays: string[]; joins: number | null; part: MockWrittenPart };

export function getDayWrittenParts(input: {
  day: number | null;
  structure: ExamStructure | null;
}): MockWrittenPart[] {
  return [...Map.groupBy(listWrittenTasks(input), (task) => task.section)].map(([name, tasks]) => ({
    minutes: tasks[0]?.minutes ?? null,
    name,
    tasks,
  }));
}

export function listWrittenRequests(input: Parameters<typeof getDayWrittenParts>[0]) {
  return getDayWrittenParts(input).flatMap((part) =>
    part.tasks.map((task) => ({ count: task.count, taskKey: task.key, unit: "answer" as const })),
  );
}

export function countPartEssays(part: MockWrittenPart): number {
  return part.tasks.reduce((sum, task) => sum + task.count, 0);
}

function findJoinedSection({
  objectiveNames,
  part,
}: {
  objectiveNames: readonly (string | null)[];
  part: MockWrittenPart;
}): { joins: number | null } {
  if (part.minutes) {
    return { joins: null };
  }

  const named = objectiveNames.findIndex((name) => name !== null && namesMatch(part.name, name));
  const joins = named === -1 ? objectiveNames.length - 1 : named;

  return { joins: joins < 0 ? null : joins };
}

function pickPartPrompts({
  candidates,
  part,
  used,
}: {
  candidates: readonly MockEssayCandidate[];
  part: MockWrittenPart;
  used: Set<string>;
}): string[] {
  const picked = new Set<string>();

  for (const task of part.tasks) {
    const own = new Set<string>();

    for (const candidate of candidates) {
      if (
        candidate.taskKey === task.key &&
        !used.has(candidate.itemId) &&
        !picked.has(candidate.itemId)
      ) {
        own.add(candidate.itemId);
      }

      if (own.size === task.count) {
        break;
      }
    }

    if (own.size !== task.count) {
      return [];
    }

    own.forEach((id) => picked.add(id));
  }

  picked.forEach((id) => used.add(id));
  return [...picked];
}

function placeWrittenParts({
  day,
  essays,
  fullLength,
  objectiveNames,
  structure,
}: {
  day: number | null;
  essays: readonly MockEssayCandidate[];
  fullLength: boolean;
  objectiveNames: readonly (string | null)[];
  structure: ExamStructure | null;
}): { parts: MockDayWrittenPart[]; placed: WrittenPlacement[] } {
  if (!fullLength) {
    return { parts: [], placed: [] };
  }

  const parts = getDayWrittenParts({ day, structure });
  const used = new Set<string>();

  const placed = parts.flatMap((part): WrittenPlacement[] => {
    const seat = findJoinedSection({ objectiveNames, part });
    const picked = pickPartPrompts({ candidates: essays, part, used });

    return picked.length === countPartEssays(part)
      ? [{ essays: picked, joins: seat.joins, part }]
      : [];
  });

  return {
    parts: parts.map((part) => ({
      asked: placed.some((placement) => placement.part === part),
      minutes: part.minutes,
      name: part.name,
      tasks: part.tasks.map(({ count, description }) => ({ count, description })),
    })),
    placed,
  };
}

export function withWrittenParts({
  day,
  essays,
  fullLength,
  sections,
  structure,
}: {
  day: number | null;
  essays: readonly MockEssayCandidate[];
  fullLength: boolean;
  sections: MockSectionPlan[];
  structure: ExamStructure | null;
}): { sections: MockSectionPlan[]; written: MockDayWrittenPart[] } {
  const { parts, placed } = placeWrittenParts({
    day,
    essays,
    fullLength,
    objectiveNames: sections.map((section) => section.name),
    structure,
  });

  const joined = sections.map((section, index) => ({
    ...section,
    essays: placed
      .filter((placement) => placement.joins === index)
      .flatMap((placement) => placement.essays),
  }));

  const sourceOf = (name: string) =>
    (structure?.mock?.sections ?? []).find(
      (section) => section.day === day && section.name === name,
    );

  const own = placed.flatMap((placement): MockSectionPlan[] =>
    placement.joins === null
      ? [
          {
            breakAfterMinutes: sourceOf(placement.part.name)?.breakAfterMinutes ?? null,
            essays: placement.essays,
            itemIds: [],
            minutes:
              placement.part.minutes ??
              countPartEssays(placement.part) * PRACTICE_MINUTES_PER_ANSWER,
            name: placement.part.name,
            questions: 0,
            routing: null,
            tools: sourceOf(placement.part.name)?.tools ?? null,
          },
        ]
      : [],
  );

  return { sections: [...joined, ...own], written: parts };
}

import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { namesMatch } from "../_utils/name-match";
import { type MockSectionPlan } from "./mock-plan";
import { isWrittenSubject } from "./written-subject";

type MockWrittenTask = { count: number | null; description: string };

export type MockWrittenPart = { minutes: number | null; name: string; tasks: MockWrittenTask[] };

export type MockDayWrittenPart = MockWrittenPart & { asked: boolean };

export type MockEssayCandidate = { area: string | null; itemId: string };

type WrittenPlacement = { essays: string[]; joins: number | null; part: MockWrittenPart };

type StructureSection = NonNullable<ExamStructure["mock"]>["sections"][number];

function toEssayTasks(structure: ExamStructure | null): MockWrittenTask[] {
  return (structure?.formats ?? [])
    .filter((format) => format.kind === "essay")
    .map((format) => ({ count: null, description: format.description }));
}

function toWrittenPart({
  section,
  structure,
}: {
  section: StructureSection;
  structure: ExamStructure | null;
}): MockWrittenPart {
  const tasks = section.tasks && section.tasks.length > 0 ? section.tasks : toEssayTasks(structure);
  return { minutes: section.minutes, name: section.name, tasks };
}

export function getDayWrittenParts({
  day,
  structure,
}: {
  day: number | null;
  structure: ExamStructure | null;
}): MockWrittenPart[] {
  const sections = (structure?.mock?.sections ?? []).filter((section) => section.day === day);
  const written = sections.filter((section) => section.kind === "written");

  if (written.length > 0) {
    return written.map((section) => toWrittenPart({ section, structure }));
  }

  const objective = sections.filter((section) => !written.includes(section));

  return (structure?.subjects ?? [])
    .filter(
      (subject) =>
        structure &&
        isWrittenSubject({ structure, subject }) &&
        objective.some((section) => namesMatch(subject.name, section.name)),
    )
    .map((subject) => ({ minutes: null, name: subject.name, tasks: toEssayTasks(structure) }));
}

function countPartEssays(part: MockWrittenPart): number {
  const counts = part.tasks.map((task) => task.count);

  return counts.length > 0 && counts.every((count) => count !== null && count > 0)
    ? counts.reduce<number>((sum, count) => sum + (count ?? 0), 0)
    : 1;
}

function findJoinedSection({
  objectiveNames,
  part,
}: {
  objectiveNames: readonly (string | null)[];
  part: MockWrittenPart;
}): { joins: number | null } | null {
  if (part.minutes) {
    return { joins: null };
  }

  const named = objectiveNames.findIndex((name) => name !== null && namesMatch(part.name, name));
  const joins = named === -1 ? objectiveNames.length - 1 : named;

  return joins < 0 ? null : { joins };
}

function assignEssays({
  essays,
  parts,
}: {
  essays: readonly MockEssayCandidate[];
  parts: readonly MockWrittenPart[];
}): { essays: string[]; part: MockWrittenPart }[] {
  const [part, ...rest] = parts;

  if (!part) {
    return [];
  }

  const own = essays.filter((essay) => essay.area !== null && namesMatch(essay.area, part.name));

  const picked = [...own, ...essays.filter((essay) => !own.includes(essay))]
    .slice(0, countPartEssays(part))
    .map((essay) => essay.itemId);

  const left = essays.filter((essay) => !picked.includes(essay.itemId));
  return [{ essays: picked, part }, ...assignEssays({ essays: left, parts: rest })];
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

  const assigned = assignEssays({ essays, parts: getDayWrittenParts({ day, structure }) });

  const placed = assigned.flatMap(({ essays: picked, part }): WrittenPlacement[] => {
    const seat = findJoinedSection({ objectiveNames, part });
    return picked.length > 0 && seat ? [{ essays: picked, joins: seat.joins, part }] : [];
  });

  return {
    parts: assigned.map(({ part }) => ({
      ...part,
      asked: placed.some((placement) => placement.part === part),
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
    placement.joins === null && placement.part.minutes
      ? [
          {
            breakAfterMinutes: sourceOf(placement.part.name)?.breakAfterMinutes ?? null,
            essays: placement.essays,
            itemIds: [],
            minutes: placement.part.minutes,
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

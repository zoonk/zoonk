import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { namesMatch } from "../_utils/name-match";
import { type MockSectionPlan } from "./mock-plan";
import { isWrittenSubject } from "./written-subject";

/** What a written part asks, as the notice states it; `count` is null when it's in the words. */
type MockWrittenTask = { count: number | null; description: string };

/**
 * A part of the exam day answered in writing (a discursive test, an essay, a legal brief), as
 * the notice states it: its own time (`minutes`), or null when it shares the clock of the day's
 * objective questions, as ENEM's essay shares the first day's five and a half hours.
 */
export type MockWrittenPart = { minutes: number | null; name: string; tasks: MockWrittenTask[] };

/**
 * A full mock's written part and whether the mock asks it (`asked`, with the exam's own essays,
 * graded at hand-in), or leaves it out because the bank has no essay for it yet.
 */
export type MockDayWrittenPart = MockWrittenPart & { asked: boolean };

/**
 * An essay question of the exam's own (`format: essay`) a full mock's written part can ask, under
 * the plan area its skill belongs to. Candidates come the learner's least recently written first.
 */
export type MockEssayCandidate = { area: string | null; itemId: string };

/**
 * A written part a full mock asks: the essays it asks and the objective section whose clock it
 * shares (`joins`, its index among the day's objective sections), or null for a part with a clock
 * of its own (the Câmara's afternoon discursive test).
 */
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

/**
 * The exam day's written parts: its written sections, or, for a notice that lists one only as a
 * subject, the written subjects its objective sections name, as ENEM's first day names its essay
 * in its section's title.
 */
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

/**
 * How many essays a written part asks: one per task the notice counts (two discursive questions
 * and a legal brief ask three), or one when the notice doesn't count them.
 */
function countPartEssays(part: MockWrittenPart): number {
  const counts = part.tasks.map((task) => task.count);

  return counts.length > 0 && counts.every((count) => count !== null && count > 0)
    ? counts.reduce<number>((sum, count) => sum + (count ?? 0), 0)
    : 1;
}

/**
 * Where a written part sits: its own section when the notice gives it its own time, else beside
 * the objective section that names it (or the day's last one). Null when it can't sit anywhere.
 */
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

/**
 * Each written part's essays, in the day's order: the ones whose area names the part first, then
 * any of the exam's left, never one twice.
 */
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

/**
 * The day's written parts in a full mock, in the day's order, each asked with the exam's own
 * essays (the ones whose area names the part first) or left out because the bank has none for it
 * yet (`parts`), and where each asked one sits (`placed`). A short mock sits half the objective
 * part and lists none.
 */
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

/**
 * A full-length mock asks the day's written parts it has essays for: an essay sharing an
 * objective section's clock joins that section (ENEM's essay beside the day's questions), and a
 * part with a time of its own is a section after the questions (a discursive test in the
 * afternoon). `written` lists the day's written parts, each asked or left out, for the mock to say.
 */
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
  /** The day's objective sections as planned, which a part without a time of its own joins. */
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

  // A written test with its own time keeps its tools and the break after it, as the notice says.
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

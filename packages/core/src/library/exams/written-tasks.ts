import { createHash, randomUUID } from "node:crypto";
import { type z } from "zod";
import { type ExamStructure } from "./blueprint-contract";
import { type sectionTaskSchema } from "./written-grading";

type Section = NonNullable<ExamStructure["mock"]>["sections"][number];
type Task = z.infer<typeof sectionTaskSchema>;

const LEVELS: NonNullable<Task["grading"]> = {
  criteria: [],
  kind: "levels",
  language: null,
  rounding: null,
  zeroing: [],
};

function label(value: string) {
  return value.normalize("NFC").trim().replaceAll(/\s+/gu, " ").toLowerCase();
}

function taskIdentity(section: Pick<Section, "name">, task: Task) {
  return JSON.stringify([label(section.name), label(task.description)]);
}

function legacyKey(section: Pick<Section, "name">, task: Task) {
  const identity = task.officialIdentifier
    ? JSON.stringify([label(section.name), label(task.officialIdentifier)])
    : taskIdentity(section, task);

  return `written-${createHash("sha256").update(identity).digest("hex").slice(0, 24)}`;
}

type Entry = { section: Section; task: Task };

function entries(structure: ExamStructure | null): Entry[] {
  return (structure?.mock?.sections ?? [])
    .filter((section) => section.kind === "written")
    .flatMap((section) => (section.tasks ?? []).map((task) => ({ section, task })));
}

function sameDimensions(first: Task, second: Task): boolean {
  return (
    first.count === second.count && first.lines === second.lines && first.points === second.points
  );
}

function match(entry: Entry, candidates: Entry[]) {
  const { officialIdentifier: official } = entry.task;

  const byOfficial = official
    ? candidates.filter(
        ({ task }) => task.officialIdentifier && label(task.officialIdentifier) === label(official),
      )
    : [];

  if (byOfficial.length === 1) {
    return byOfficial;
  }

  const inSection = candidates.filter(
    ({ section }) => label(section.name) === label(entry.section.name),
  );

  const candidatesByIdentifier = inSection.filter(
    ({ task }) => !official || !task.officialIdentifier || byOfficial.length > 0,
  );

  const labeled = candidatesByIdentifier.filter(
    ({ task }) =>
      label(task.description) === label(entry.task.description) &&
      task.count === entry.task.count &&
      (task.lines === undefined ||
        entry.task.lines === undefined ||
        task.lines === entry.task.lines) &&
      (task.points === undefined ||
        entry.task.points === undefined ||
        task.points === entry.task.points),
  );

  if (labeled.length > 0) {
    return labeled;
  }

  return !official && inSection.length === entry.section.tasks?.length
    ? candidatesByIdentifier.filter(
        ({ task }) => !task.officialIdentifier && sameDimensions(task, entry.task),
      )
    : [];
}

export function withWrittenTaskKeys({
  current,
  next,
}: {
  current: ExamStructure | null;
  next: ExamStructure;
}): ExamStructure {
  const incoming = entries(next);

  if (!next.mock || incoming.length === 0) {
    return next;
  }

  const old = entries(current);

  const oldKeys = new Set(old.map(({ section, task }) => task.key ?? legacyKey(section, task)));

  const legacyCounts = Map.groupBy(incoming, ({ section, task }) => legacyKey(section, task));

  const keys = new Map(
    incoming.map((entry) => {
      const [prior, ...ambiguous] = match(entry, old);
      const sameIncoming = match(entry, incoming);

      const legacy = legacyKey(entry.section, entry.task);

      if (
        ambiguous.length > 0 ||
        sameIncoming.length !== 1 ||
        (prior !== undefined && match(prior, incoming).length !== 1)
      ) {
        return [entry.task, randomUUID()] as const;
      }

      if (prior) {
        return [entry.task, prior.task.key ?? legacyKey(prior.section, prior.task)] as const;
      }

      const key =
        oldKeys.has(legacy) || legacyCounts.get(legacy)?.length !== 1 ? randomUUID() : legacy;

      return [entry.task, key] as const;
    }),
  );

  return {
    ...next,
    mock: {
      ...next.mock,
      sections: next.mock.sections.map((section) =>
        section.kind === "written"
          ? { ...section, tasks: section.tasks?.map((task) => ({ ...task, key: keys.get(task) })) }
          : section,
      ),
    },
  };
}

function toTask({
  section,
  task,
}: {
  section: Pick<Section, "minutes" | "name" | "session">;
  task: Task;
}) {
  return {
    count: task.count,
    description: task.description,
    grading: task.grading ?? LEVELS,
    handwritten: task.handwritten ?? null,
    key: task.key ?? legacyKey(section, task),
    lines: task.lines ?? null,
    minutes: section.minutes && section.minutes > 0 ? section.minutes : null,
    points: task.points ?? null,
    section: section.name,
    session: section.session ?? null,
    subjects: task.subjects ?? null,
  };
}

function provisional(description: string): Task {
  return { count: 1, description };
}

export function sharesObjectiveClock({
  section,
  sections,
}: {
  section: Pick<Section, "day" | "name">;
  sections: readonly Section[];
}): boolean {
  return sections.some(
    (other) =>
      other.kind === "objective" &&
      other.day === section.day &&
      label(other.name) === label(section.name),
  );
}

export function listWrittenTasks({
  day,
  structure,
}: {
  day?: number | null;
  structure: ExamStructure | null;
}): ReturnType<typeof toTask>[] {
  const sections = structure?.mock?.sections ?? [];
  const written = sections.filter((section) => section.kind === "written");
  const essays = structure?.formats.filter((format) => format.kind === "essay") ?? [];

  if (written.length > 0) {
    return written
      .filter((section) => day === undefined || section.day === day)
      .flatMap((section) => {
        const tasks = section.tasks?.length ? section.tasks : [provisional(section.name)];

        const shared = sharesObjectiveClock({ section, sections });

        return tasks.map((task) =>
          toTask({ section: shared ? { ...section, minutes: null } : section, task }),
        );
      });
  }

  const format = essays[0];

  if (!format) {
    return [];
  }

  const named = essays.flatMap((essay) => essay.sections ?? []);

  const associated = sections.filter((section) =>
    named.some((name) => label(name) === label(section.name)),
  );

  const shared = associated.length === 1 ? associated[0] : undefined;

  if (day !== undefined && (shared?.day ?? null) !== day) {
    return [];
  }

  const description = format.description || shared?.name || "Essay";

  return [
    toTask({
      section: { minutes: null, name: shared?.name ?? description, session: shared?.session },
      task: provisional(description),
    }),
  ];
}

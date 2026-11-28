import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { listWrittenTasks } from "../../library/exams/written-tasks";
import { namesMatch } from "../_utils/name-match";
import { type WrittenProjection } from "./written-points-contract";

type Part = WrittenProjection["parts"][number];
export type WritingRange = NonNullable<Part["range"]>;
const POINTS_TOLERANCE = 1e-6;
const SCORE_PRECISION = 15;

export type WrittenTask = ReturnType<typeof listWrittenTasks>[number];

export function addWritingPoints(first: number, second: number): number {
  return Number((first + second).toPrecision(SCORE_PRECISION));
}

export function sumRanges(ranges: readonly (WritingRange | null)[]): WritingRange | null {
  if (ranges.length === 0 || ranges.some((range) => range === null)) {
    return null;
  }

  return ranges.reduce<WritingRange>(
    (sum, range) => ({ high: sum.high + (range?.high ?? 0), low: sum.low + (range?.low ?? 0) }),
    { high: 0, low: 0 },
  );
}

export function scaleWritingRange(range: WritingRange, factor: number): WritingRange {
  return { high: range.high * factor, low: range.low * factor };
}

export function writtenStanding({
  max,
  minimum,
  range,
}: Omit<Part, "name" | "standing" | "tasks">): Part["standing"] {
  if (!minimum) {
    return null;
  }

  if (!range || (minimum.unit === "percent" && max === null)) {
    return "unmeasured";
  }

  const threshold = minimum.unit === "percent" ? ((max ?? 0) * minimum.value) / 100 : minimum.value;

  if (range.low >= threshold - POINTS_TOLERANCE) {
    return "met";
  }

  return range.high < threshold - POINTS_TOLERANCE ? "below" : "overlaps";
}

export function scoreWrittenParts({
  rangeForTask,
  structure,
  tasks = listWrittenTasks({ structure }),
}: {
  rangeForTask: (task: WrittenTask) => WritingRange | null;
  structure: ExamStructure | null;
  tasks?: readonly WrittenTask[];
}): Part[] {
  const partRules = structure?.mock?.scoring.parts ?? [];

  return [...Map.groupBy(tasks, (task) => task.section)].map(([name, own]) => {
    const rule = partRules.find((part) => namesMatch(part.name, name));

    const scored = own.map((task) => ({
      key: task.key,
      max: task.points === null ? null : task.points * task.count,
      name: task.description,
      range: rangeForTask(task),
    }));

    const max =
      rule?.maxPoints ??
      (scored.every((task) => task.max !== null)
        ? scored.reduce((total, task) => total + (task.max ?? 0), 0)
        : null);

    const minimum = rule?.minimum ?? null;
    const range = sumRanges(scored.map((task) => task.range));

    return {
      max,
      minimum,
      name,
      range,
      standing: writtenStanding({ max, minimum, range: null }),
      tasks: scored,
    };
  });
}

export function getWrittenPartMinimum({
  structure,
  taskKey,
}: {
  structure: ExamStructure | null;
  taskKey: string;
}) {
  const part = scoreWrittenParts({ rangeForTask: () => null, structure }).find(({ tasks }) =>
    tasks.some(({ key }) => key === taskKey),
  );

  return part?.minimum ? { max: part.max, minimum: part.minimum } : undefined;
}

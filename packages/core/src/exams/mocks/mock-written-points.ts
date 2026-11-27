import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { namesMatch } from "../_utils/name-match";
import {
  type CalibratedWritingGrade,
  calibratedWrittenStanding,
} from "../scoring/calibrated-written-standing";
import { scaleWritingRange, scoreWrittenParts, sumRanges } from "../scoring/written-points";
import { type MockConditions, type MockResult } from "./mock-contract";
import { type MockPoints } from "./mock-points-contract";
import { type MockEssayView } from "./mock-view-contract";
import { type MockEssayCandidate, getDayWrittenParts } from "./written-parts";

export function snapshotMockWriting({
  day,
  essays,
  structure,
}: {
  day: number | null;
  essays: readonly MockEssayCandidate[];
  structure: ExamStructure | null;
}): Pick<MockConditions, "writtenParts"> {
  if (essays.length === 0) {
    return {};
  }

  const tasks = getDayWrittenParts({ day, structure }).flatMap((part) => part.tasks);

  return {
    writtenParts: scoreWrittenParts({ rangeForTask: () => null, structure, tasks }).map((part) => ({
      ...part,
      tasks: part.tasks.map((task) => ({
        ...task,
        count: tasks.find(({ key }) => key === task.key)?.count,
        itemIds: essays.filter((essay) => essay.taskKey === task.key).map((essay) => essay.itemId),
      })),
    })),
  };
}

export function mockWrittenStanding({
  grades,
  part,
}: {
  grades: ReadonlyMap<string, CalibratedWritingGrade>;
  part: NonNullable<MockConditions["writtenParts"]>[number];
}) {
  const itemIds = part.tasks.flatMap((task) => task.itemIds);

  const complete =
    part.tasks.every(({ count, itemIds: ids }) => count === ids.length) &&
    new Set(itemIds).size === itemIds.length;

  return calibratedWrittenStanding({
    grades: complete ? itemIds.map((id) => grades.get(id) ?? null) : [],
    part,
  });
}

export function withMockWrittenPoints({
  conditions,
  essays,
  grades,
  numericBlankItems,
  result,
}: {
  conditions: MockConditions;
  essays: readonly MockEssayView[];
  grades: ReadonlyMap<string, CalibratedWritingGrade>;
  numericBlankItems: ReadonlySet<string>;
  result: MockResult | null;
}): MockResult | null {
  if (!result || !conditions.writtenParts?.length) {
    return result;
  }

  const byItem = new Map(essays.map((essay) => [essay.itemId, essay]));

  const written = conditions.writtenParts.map((part) => {
    const tasks = part.tasks.map(({ count: _count, itemIds, ...task }) => {
      const shares = sumRanges(
        itemIds.map((id) => {
          if (numericBlankItems.has(id)) {
            return { high: 0, low: 0 };
          }

          const grade = byItem.get(id)?.grade;

          return grade && "kind" in grade && grade.kind === "points"
            ? scaleWritingRange(grade.total, 1 / grade.max)
            : null;
        }),
      );

      const range =
        task.max !== null && shares && itemIds.length > 0
          ? scaleWritingRange(shares, task.max / itemIds.length)
          : null;

      return { ...task, range };
    });

    const range = sumRanges(tasks.map((task) => task.range));
    return { ...part, range, standing: mockWrittenStanding({ grades, part }), tasks };
  });

  const points: MockPoints = result.points ?? {
    asked: 0,
    earned: 0,
    max: null,
    met: null,
    minimum: null,
    parts: [],
    projected: null,
    short: null,
    unjudged: [],
  };

  return {
    ...result,
    points: {
      ...points,
      unjudged: points.unjudged.filter(
        (minimum) =>
          !written.some((part) => minimum.name !== null && namesMatch(part.name, minimum.name)),
      ),
      written,
    },
  };
}

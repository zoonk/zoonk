import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { matchAreasToSubjects } from "../../view-models/syllabus/_utils/match-areas";
import { Z_90 } from "../scoring/irt";
import { type MockResult, type MockVerdict } from "./mock-contract";

type Area = MockResult["areas"][number];

type Subject = Pick<ExamStructure["subjects"][number], "name" | "partOf" | "shortName">;

const NO_VERDICT: MockVerdict = { strongest: null, weakest: null };

/** The share of right answers as a 90% range, as sure as the IRT ranges (a Wilson score interval). */
function getRightShareRange({ correct, total }: Area): { high: number; low: number } {
  const share = correct / total;
  const shift = Z_90 ** 2 / (2 * total);
  const scale = 1 + 2 * shift;
  const center = (share + shift) / scale;

  const margin =
    (Z_90 / scale) * Math.sqrt((share * (1 - share)) / total + (Z_90 / (2 * total)) ** 2);

  return { high: center + margin, low: center - margin };
}

/** Where a wrong answer loses points, the points rank; mocks graded before areas kept their points have only right answers. */
function getPointsShare(area: Area): number {
  const { asked, earned } = area.points ?? { asked: area.total, earned: area.correct };
  return asked > 0 ? earned / asked : 0;
}

/**
 * An estimated score is above another only when its range's bottom is above the other's top. Right
 * answers are ranged the same way, and their points must agree, so a net score's penalty never ranks
 * a subject above one that scored more.
 */
function isAbove(first: Area, second: Area): boolean {
  if (first.score && second.score) {
    return first.score.low > second.score.high;
  }

  return (
    getRightShareRange(first).low > getRightShareRange(second).high &&
    getPointsShare(first) > getPointsShare(second)
  );
}

/** A part (a foreign language in its area) and the subject it belongs to, by the notice's subjects. */
function findPartAndWhole({
  areas,
  subjects,
}: {
  areas: readonly Area[];
  subjects: readonly Subject[];
}): (first: Area, second: Area) => boolean {
  const matches = matchAreasToSubjects({ areas: areas.map((area) => area.name), subjects });

  const subjectOf = (area: Area) => {
    const index = matches.get(area.name);
    return index === undefined ? undefined : subjects[index];
  };

  return (first, second) => {
    const one = subjectOf(first);
    const other = subjectOf(second);
    return Boolean(one && other && (one.partOf === other.name || other.partOf === one.name));
  };
}

/**
 * The subject that went best and the one to work on, each only where its numbers stand clear of
 * every other subject's, never measured against the subject it's part of or its own parts. A mock
 * with no right answer, or no miss, names neither, since estimates still rank subjects there.
 */
export function getMockVerdict({
  result,
  subjects,
}: {
  result: Pick<MockResult, "areas">;
  subjects: readonly Subject[];
}): MockVerdict {
  const areas = result.areas.filter((area) => area.total > 0);

  if (
    !areas.some((area) => area.correct > 0) ||
    areas.every((area) => area.correct >= area.total)
  ) {
    return NO_VERDICT;
  }

  const isPartAndWhole = findPartAndWhole({ areas, subjects });

  const standsClear = (area: Area, clears: (other: Area) => boolean) => {
    const others = areas.filter((other) => other !== area && !isPartAndWhole(area, other));
    return others.length > 0 && others.every((other) => clears(other));
  };

  const strongest = areas.find(
    (area) => area.correct > 0 && standsClear(area, (other) => isAbove(area, other)),
  );

  const weakest = areas.find(
    (area) => area.correct < area.total && standsClear(area, (other) => isAbove(other, area)),
  );

  if (strongest && weakest && isPartAndWhole(strongest, weakest)) {
    return NO_VERDICT;
  }

  return { strongest: strongest?.name ?? null, weakest: weakest?.name ?? null };
}

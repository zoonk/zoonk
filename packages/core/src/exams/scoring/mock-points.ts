import { type PointsMinimum } from "../../library/exams/blueprint-contract";
import { type MockConditions } from "../mocks/mock-contract";
import { type ItemMarking, type MockMarking, type MockPoints } from "../mocks/mock-points-contract";
import { type NetOutcome } from "./net-score";

export type PointsAnswer = { credit: number; marking: ItemMarking; outcome: NetOutcome };

/** `full` judges minimums, `half` projects them without a verdict, `none` checks nothing. */
export type PointsScope = "full" | "half" | "none";

type MarkedPart = MockMarking["parts"][number];
type Tally = Omit<MockPoints, "parts" | "unjudged">;

const PERCENT = 100;

/** Sums of fractional penalties (a third of 2 points) carry float noise that no score means. */
const PRECISION = 1e6;
const TOLERANCE = 1 / PRECISION;

function withoutNoise(value: number): number {
  return Math.round(value * PRECISION) / PRECISION;
}

export function getPointsScope(
  conditions: Pick<MockConditions, "fullLength" | "purpose" | "shape">,
): PointsScope {
  if (conditions.purpose === "placement" || conditions.shape?.kind === "area") {
    return "none";
  }

  return conditions.fullLength ? "full" : "half";
}

export function getItemMarking({
  conditions,
  itemId,
}: {
  conditions: Pick<MockConditions, "marking" | "wrongPenalty">;
  itemId: string;
}): ItemMarking {
  return (
    conditions.marking?.items[itemId] ?? {
      part: null,
      points: 1,
      wrongPenalty: conditions.wrongPenalty,
    }
  );
}

function getAnswerPoints({ credit, marking, outcome }: PointsAnswer): number {
  if (outcome === "blank") {
    return 0;
  }

  return outcome === "wrong" ? -marking.points * marking.wrongPenalty : marking.points * credit;
}

function sumPoints(answers: readonly PointsAnswer[]) {
  return {
    asked: withoutNoise(answers.reduce((sum, answer) => sum + answer.marking.points, 0)),
    earned: withoutNoise(answers.reduce((sum, answer) => sum + getAnswerPoints(answer), 0)),
  };
}

function toScore({
  asked,
  earned,
  unit,
}: {
  asked: number;
  earned: number;
  unit: PointsMinimum["unit"];
}): number | null {
  if (unit === "points") {
    return earned;
  }

  return asked > 0 ? (earned / asked) * PERCENT : null;
}

function judge({
  asked,
  earned,
  minimum,
}: {
  asked: number;
  earned: number;
  minimum: PointsMinimum;
}): Pick<Tally, "met" | "short"> {
  const score = toScore({ asked, earned, unit: minimum.unit });

  if (score === null) {
    return { met: null, short: null };
  }

  const met = score + TOLERANCE >= minimum.value;
  return { met, short: met ? null : withoutNoise(minimum.value - score) };
}

function isWholeTest({ asked, max }: { asked: number; max: number | null }): boolean {
  return max === null || Math.abs(asked - max) < TOLERANCE;
}

function project({ asked, earned, max }: { asked: number; earned: number; max: number | null }) {
  return max !== null && asked > 0 && !isWholeTest({ asked, max })
    ? withoutNoise((earned / asked) * max)
    : null;
}

function toTally({
  asked,
  earned,
  max,
  minimum,
  projected,
  scope,
  whole,
}: {
  asked: number;
  earned: number;
  max: number | null;
  minimum: PointsMinimum | null;
  projected: number | null;
  scope: PointsScope;
  whole: boolean;
}): Tally {
  const verdict =
    minimum && scope === "full" && whole
      ? judge({ asked, earned, minimum })
      : { met: null, short: null };

  return { asked, earned, max, minimum, projected, ...verdict };
}

function scorePart({
  answers,
  part,
  scope,
}: {
  answers: readonly PointsAnswer[];
  part: MarkedPart;
  scope: PointsScope;
}) {
  const { asked, earned } = sumPoints(answers);
  const max = part.maxPoints;

  return {
    ...toTally({
      asked,
      earned,
      max,
      minimum: part.minimum,
      projected: project({ asked, earned, max }),
      scope,
      whole: isWholeTest({ asked, max }),
    }),
    name: part.name,
    qualifying: part.qualifying,
  };
}

function isCounted(part: MarkedPart): boolean {
  return part.objective && !part.qualifying;
}

function sumProjections(parts: readonly ReturnType<typeof scorePart>[]): number | null {
  const projections = parts.map((part) =>
    isWholeTest({ asked: part.asked, max: part.max }) ? part.earned : part.projected,
  );

  return projections.every((value) => value !== null)
    ? withoutNoise(projections.reduce((sum, value) => sum + value, 0))
    : null;
}

function scoreTotal({
  answers,
  marking,
  parts,
  scope,
}: {
  answers: readonly PointsAnswer[];
  marking: MockMarking;
  parts: readonly ReturnType<typeof scorePart>[];
  scope: PointsScope;
}): Tally & { judged: boolean } {
  const counted = marking.parts.filter((part) => isCounted(part));
  const countedNames = new Set(counted.map((part) => part.name));
  const qualifying = new Set(marking.parts.flatMap((part) => (part.qualifying ? [part.name] : [])));

  const inTotal = answers.filter(({ marking: { part } }) =>
    counted.length > 0
      ? part !== null && countedNames.has(part)
      : part === null || !qualifying.has(part),
  );

  const { asked, earned } = sumPoints(inTotal);
  const countedParts = parts.filter((part) => countedNames.has(part.name));
  const judged = counted.length > 0 ? countedParts.length === counted.length : asked > 0;
  const max = marking.maxPoints;

  const projected =
    counted.length > 0 ? sumProjections(countedParts) : project({ asked, earned, max });

  const whole =
    counted.length > 0
      ? countedParts.every((part) => isWholeTest({ asked: part.asked, max: part.max }))
      : isWholeTest({ asked, max });

  return {
    ...toTally({
      asked,
      earned,
      max,
      minimum: judged ? marking.totalMinimum : null,
      projected: judged && !whole ? projected : null,
      scope,
      whole,
    }),
    judged,
  };
}

function scoreMockOnly(answers: readonly PointsAnswer[]): MockPoints {
  const { asked, earned } = sumPoints(answers);

  return {
    asked,
    earned,
    max: null,
    met: null,
    minimum: null,
    parts: [],
    projected: null,
    short: null,
    unjudged: [],
  };
}

export function scoreMockPoints({
  answers,
  marking,
  scope,
}: {
  answers: readonly PointsAnswer[];
  marking: MockMarking;
  scope: PointsScope;
}): MockPoints {
  if (scope === "none") {
    return scoreMockOnly(answers);
  }

  const parts = marking.parts.flatMap((part) => {
    const own = answers.filter((answer) => answer.marking.part === part.name);
    return own.length > 0 ? [scorePart({ answers: own, part, scope })] : [];
  });

  const asked = new Set(parts.map((part) => part.name));
  const { judged, ...total } = scoreTotal({ answers, marking, parts, scope });

  const unjudged = [
    ...marking.parts.flatMap((part) =>
      part.minimum && !asked.has(part.name) ? [{ minimum: part.minimum, name: part.name }] : [],
    ),
    ...(marking.totalMinimum && !judged ? [{ minimum: marking.totalMinimum, name: null }] : []),
  ];

  return { ...total, parts, unjudged };
}

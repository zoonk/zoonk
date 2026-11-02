import { type ActivityContentFor } from "@zoonk/core/library/activities/templates";
import { type NumericDomain, niceTicks } from "@zoonk/utils/plot-scale";
import { isMultiple } from "../_utils/snap-value";

type Fields = ActivityContentFor<"distributionExplorer">["fields"];
export type Distribution = Fields["distribution"];
export type Interval = Fields["handles"];

const NORMAL_REACH = 3.5;
const UNIFORM_MARGIN = 0.25;
const SAMPLES = 120;
const MIN_POSITIONS = 20;
const MAX_POSITIONS = 1000;
/* oxlint-disable-next-line no-magic-numbers -- Round step multipliers, largest first. */
const STEP_MULTIPLIERS = [5, 2, 1] as const;
const MULTIPLE_SLACK = 1e-9;
const SD_TICKS = 3;
const UNIFORM_TICKS = 4;

function densityAt(distribution: Distribution, value: number): number {
  if (distribution.kind === "uniform") {
    const inside = value >= distribution.min && value <= distribution.max;
    return inside ? 1 / (distribution.max - distribution.min) : 0;
  }

  const z = (value - distribution.mean) / distribution.sd;
  return Math.exp(-(z * z) / 2) / (distribution.sd * Math.sqrt(2 * Math.PI));
}

export function distributionDomain({
  distribution,
  handles,
  target,
}: {
  distribution: Distribution;
  handles: Interval;
  target: Interval;
}): NumericDomain {
  const [low, high] =
    distribution.kind === "normal"
      ? [
          distribution.mean - NORMAL_REACH * distribution.sd,
          distribution.mean + NORMAL_REACH * distribution.sd,
        ]
      : [
          distribution.min - (distribution.max - distribution.min) * UNIFORM_MARGIN,
          distribution.max + (distribution.max - distribution.min) * UNIFORM_MARGIN,
        ];

  return [Math.min(low, handles.from, target.from), Math.max(high, handles.to, target.to)];
}

function fitsAll(values: readonly number[], step: number): boolean {
  return values.every((value) => isMultiple(value, step));
}

function candidateSteps(span: number): number[] {
  const top = Math.floor(Math.log10(span));

  return Array.from({ length: 5 }, (_, index) => 10 ** (top - index))
    .flatMap((power) => STEP_MULTIPLIERS.map((multiplier) => multiplier * power))
    .filter((step) => span / step >= MIN_POSITIONS && span / step <= MAX_POSITIONS);
}

function landmarks(distribution: Distribution): number[] {
  if (distribution.kind === "uniform") {
    return [distribution.min, distribution.max];
  }

  return Array.from(
    { length: 2 * SD_TICKS + 1 },
    (_, index) => distribution.mean + (index - SD_TICKS) * distribution.sd,
  );
}

export function handleStep({
  distribution,
  domain,
  handles,
  target,
}: {
  distribution: Distribution;
  domain: NumericDomain;
  handles: Interval;
  target: Interval;
}): number {
  const candidates = candidateSteps(domain[1] - domain[0]);
  const required = [target.from, target.to];
  const preferred = [...required, handles.from, handles.to, ...landmarks(distribution)];

  return (
    candidates.find((step) => fitsAll(preferred, step)) ??
    candidates.find((step) => fitsAll(required, step)) ??
    candidates.at(-1) ??
    (domain[1] - domain[0]) / MIN_POSITIONS
  );
}

export function snapDomain(domain: NumericDomain, step: number): NumericDomain {
  return [Math.floor(domain[0] / step) * step, Math.ceil(domain[1] / step) * step];
}

export function densityCurve(
  distribution: Distribution,
  [from, to]: NumericDomain,
): { x: number; y: number }[] {
  const edges =
    distribution.kind === "uniform"
      ? [distribution.min, distribution.max].filter((edge) => edge > from && edge < to)
      : [];

  const xs = [
    ...Array.from({ length: SAMPLES + 1 }, (_, index) => from + ((to - from) * index) / SAMPLES),
    ...edges.flatMap((edge) => [edge - MULTIPLE_SLACK, edge + MULTIPLE_SLACK]),
  ].toSorted((first, second) => first - second);

  return xs.map((x) => ({ x, y: densityAt(distribution, x) }));
}

export function distributionTicks(distribution: Distribution, domain: NumericDomain): number[] {
  return distribution.kind === "normal"
    ? landmarks(distribution).filter((value) => value >= domain[0] && value <= domain[1])
    : niceTicks(domain, UNIFORM_TICKS);
}

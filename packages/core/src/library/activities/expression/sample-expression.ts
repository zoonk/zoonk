import { evaluateExpression } from "./evaluate-expression";
import { parseExpression } from "./parse-expression";

const MAX_SAMPLE_POINTS = 4096;
const MAX_SAMPLES_PER_RANGE = 33;

export type ExpressionRange = { max: number; min: number; name: string; step?: number };

export type SampleExpressionResult =
  | { ok: true; points: number }
  | { ok: false; error: string; point: Record<string, number> | null };

function snap(value: number, range: ExpressionRange): number {
  if (!range.step) {
    return value;
  }

  const snapped = range.min + Math.round((value - range.min) / range.step) * range.step;

  return Math.min(snapped, range.max);
}

function sampleRange(range: ExpressionRange, count: number): number[] {
  if (range.max <= range.min) {
    return [range.min];
  }

  const values = Array.from({ length: count }, (_, index) =>
    snap(range.min + ((range.max - range.min) * index) / (count - 1), range),
  );

  return [...new Set([range.min, ...values, range.max])];
}

function samplesPerRange(rangeCount: number): number {
  const count = Math.floor(MAX_SAMPLE_POINTS ** (1 / Math.max(rangeCount, 1)));

  return Math.min(Math.max(count, 2), MAX_SAMPLES_PER_RANGE);
}

function buildPoints(ranges: readonly ExpressionRange[]): Record<string, number>[] {
  const count = samplesPerRange(ranges.length);

  return ranges.reduce<Record<string, number>[]>(
    (points, range) =>
      points.flatMap((point) =>
        sampleRange(range, count).map((value) => ({ ...point, [range.name]: value })),
      ),
    [{}],
  );
}

/** Samples a bounded grid; a successful result does not prove unsampled points are valid. */
export function sampleExpression(params: {
  expression: string;
  ranges: readonly ExpressionRange[];
}): SampleExpressionResult {
  const parsed = parseExpression(params.expression);

  if (!parsed.ok) {
    return { error: parsed.error.message, ok: false, point: null };
  }

  const points = buildPoints(params.ranges);

  const failed = points
    .map((point) => ({ point, result: evaluateExpression(parsed.expression, point) }))
    .find((sample) => !sample.result.ok);

  if (failed && !failed.result.ok) {
    return { error: failed.result.error, ok: false, point: failed.point };
  }

  return { ok: true, points: points.length };
}

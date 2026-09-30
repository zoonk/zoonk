import { evaluateExpression } from "@zoonk/core/library/activities/expression/evaluate";
import { parseExpression } from "@zoonk/core/library/activities/expression/parse";
import { type NumericDomain } from "./plot-scale";

export type PlotPoint = { x: number; y: number };

const DEFAULT_SAMPLES = 64;

/**
 * Evaluates a one-variable formula across a range with core's safe evaluator, for drawing its
 * curve. The validator already proved the formula works across the slider range, so a failing
 * point only drops out of the drawing instead of breaking the canvas.
 */
export function sampleFormula({
  domain,
  fixed = {},
  formula,
  samples = DEFAULT_SAMPLES,
  variable,
}: {
  domain: NumericDomain;
  fixed?: Readonly<Record<string, number>>;
  formula: string;
  samples?: number;
  variable: string;
}): PlotPoint[] {
  const parsed = parseExpression(formula);

  if (!parsed.ok) {
    return [];
  }

  const [min, max] = domain;
  const count = Math.max(Math.round(samples), 1);

  return Array.from({ length: count + 1 }, (_, index) => min + ((max - min) * index) / count)
    .map((x) => ({ result: evaluateExpression(parsed.expression, { ...fixed, [variable]: x }), x }))
    .flatMap(({ result, x }) => (result.ok ? [{ x, y: result.value }] : []));
}

/** An SVG path through the points, already mapped to pixels. */
export function linePath(points: readonly PlotPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

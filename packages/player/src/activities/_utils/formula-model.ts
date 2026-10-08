import { niceDomain } from "@zoonk/utils/plot-scale";
import { type PlotPoint, sampleFormula } from "./sample-formula";

type Variable = { initial: number; max: number; min: number; name: string };

export type ModelValues = Readonly<Record<string, number>>;

/** Where every slider starts. */
export function startingValues(variables: readonly Variable[]): Record<string, number> {
  return Object.fromEntries(variables.map((variable) => [variable.name, variable.initial]));
}

/** The output the check reads (or the first), which the chart draws. */
export function primaryOutput<TOutput extends { id: string }>({
  check,
  fields,
}: {
  check: { kind: string; output?: string };
  fields: { outputs: readonly TOutput[] };
}): TOutput | undefined {
  const target = check.kind === "interaction" ? undefined : check.output;
  return fields.outputs.find((output) => output.id === target) ?? fields.outputs[0];
}

/** Whether any slider other than `except` moved from where it started. */
export function othersMoved({
  except,
  values,
  variables,
}: {
  except: string;
  values: ModelValues;
  variables: readonly Variable[];
}): boolean {
  return variables.some(
    (variable) => variable.name !== except && values[variable.name] !== variable.initial,
  );
}

/**
 * An output's curve as one slider sweeps its range while everything else stays at `values`,
 * drawn with core's evaluator like the slider graph.
 */
export function outputCurve({
  formula,
  values,
  variable,
}: {
  formula: string;
  values: ModelValues;
  variable: Variable;
}): PlotPoint[] {
  return sampleFormula({
    domain: [variable.min, variable.max],
    fixed: values,
    formula,
    variable: variable.name,
  });
}

/** Every on/off combination of the events, from all off to all on. */
export function eventCombinations(names: readonly string[]): Record<string, number>[] {
  return names.reduce<Record<string, number>[]>(
    (combinations, name) =>
      combinations.flatMap((combination) => [
        { ...combination, [name]: 0 },
        { ...combination, [name]: 1 },
      ]),
    [{}],
  );
}

/**
 * A y axis that holds every curve the learner can reach by flipping events, so toggling one
 * moves the curve instead of rescaling the whole chart.
 */
export function stableDomain(curves: readonly (readonly PlotPoint[])[]) {
  return niceDomain(curves.flatMap((curve) => curve.map((point) => point.y)));
}

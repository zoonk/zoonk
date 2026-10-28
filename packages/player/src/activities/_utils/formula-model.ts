import { niceDomain } from "@zoonk/utils/plot-scale";
import { type PlotPoint, sampleFormula } from "./sample-formula";

type Variable = { initial: number; max: number; min: number; name: string };

export type ModelValues = Readonly<Record<string, number>>;

export function startingValues(variables: readonly Variable[]): Record<string, number> {
  return Object.fromEntries(variables.map((variable) => [variable.name, variable.initial]));
}

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

export function stableDomain(curves: readonly (readonly PlotPoint[])[]) {
  return niceDomain(curves.flatMap((curve) => curve.map((point) => point.y)));
}

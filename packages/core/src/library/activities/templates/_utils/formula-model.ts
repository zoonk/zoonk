import { type ActivityOutput, type ActivityVariable } from "../../activity-schemas";
import {
  type ActivityCheckTarget,
  type ActivityFormula,
  type ActivityIssue,
} from "../../define-activity-template";
import { type ExpressionRange } from "../../expression/sample-expression";
import {
  duplicateIssues,
  evaluateOrNull,
  resolveSliderValues,
  toRange,
  variableIssues,
} from "./template-helpers";

/**
 * Sliders driving formula outputs (simulations, calculators, scenarios): every output formula is
 * sampled across every slider range, plus any extra ranges such as on/off events.
 */
export function outputFormulas(params: {
  extraRanges?: readonly ExpressionRange[];
  outputs: readonly ActivityOutput[];
  variables: readonly ActivityVariable[];
}): ActivityFormula[] {
  const ranges = [
    ...params.variables.map((variable) => toRange(variable)),
    ...(params.extraRanges ?? []),
  ];

  return params.outputs.map((output, index) => ({
    expression: output.formula,
    path: `fields.outputs.${index}.formula`,
    ranges,
  }));
}

/**
 * Reads the output a check names (or the default one) with the sliders where the check puts them.
 * `fixed` holds values that aren't sliders, like events that start switched off.
 */
export function computeOutput(params: {
  defaultOutput: string | undefined;
  fixed?: Readonly<Record<string, number>>;
  outputs: readonly ActivityOutput[];
  target: ActivityCheckTarget;
  variables: readonly ActivityVariable[];
}): number | null {
  const outputId = params.target.output ?? params.defaultOutput;
  const output = params.outputs.find((item) => item.id === outputId);
  const fixed = params.fixed ?? {};

  const sliderInputs = Object.fromEntries(
    Object.entries(params.target.inputs).filter(([name]) => !Object.hasOwn(fixed, name)),
  );

  const values = resolveSliderValues(params.variables, { ...params.target, inputs: sliderInputs });

  if (!output || !values) {
    return null;
  }

  const fixedInputs = Object.fromEntries(
    Object.entries(params.target.inputs).filter(([name]) => Object.hasOwn(fixed, name)),
  );

  return evaluateOrNull(output.formula, { ...fixed, ...fixedInputs, ...values });
}

export function formulaModelIssues(params: {
  outputs: readonly ActivityOutput[];
  variables: readonly ActivityVariable[];
}): ActivityIssue[] {
  return [
    ...duplicateIssues(
      params.variables.map((variable) => variable.name),
      "fields.variables",
      "Slider",
    ),
    ...duplicateIssues(
      params.outputs.map((output) => output.id),
      "fields.outputs",
      "Output",
    ),
    ...params.variables.flatMap((variable, index) =>
      variableIssues(variable, `fields.variables.${index}`),
    ),
  ];
}

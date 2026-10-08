import { type ActivityContentFor } from "@zoonk/core/library/activities/templates";
import { startingValues } from "../_utils/formula-model";
import { type PlotPoint, sampleFormula } from "../_utils/sample-formula";

type ActivityVariable = ActivityContentFor<"parameterSimulation">["fields"]["variables"][number];

/** Where every slider sits, by variable name. */
type SliderValues = Readonly<Record<string, number>>;

/** The sliders where a check puts them: at their start, moved by the check's inputs. */
export function checkValues(
  variables: readonly ActivityVariable[],
  inputs: readonly { name: string; value: number }[] = [],
): SliderValues {
  return {
    ...startingValues(variables),
    ...Object.fromEntries(inputs.map((input) => [input.name, input.value])),
  };
}

/** Whether two slider settings differ anywhere except on the plotted axis. */
export function othersDiffer({
  first,
  second,
  xName,
}: {
  first: SliderValues;
  second: SliderValues;
  xName: string;
}): boolean {
  return Object.keys(first).some((name) => name !== xName && first[name] !== second[name]);
}

/** The output across the x slider's whole range, with every other slider held where it is. */
export function sweepCurve({
  formula,
  values,
  x,
}: {
  formula: string;
  values: SliderValues;
  x: ActivityVariable;
}): PlotPoint[] {
  return sampleFormula({ domain: [x.min, x.max], fixed: values, formula, variable: x.name });
}

/** The highest point of a curve, for describing its shape in words. */
export function curvePeak(points: readonly PlotPoint[]): PlotPoint | null {
  return points.reduce<PlotPoint | null>(
    (peak, point) => (peak === null || point.y > peak.y ? point : peak),
    null,
  );
}

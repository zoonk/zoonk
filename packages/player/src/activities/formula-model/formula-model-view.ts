import { useFormatNumber } from "@zoonk/learn/format-number";
import { type NumericDomain } from "@zoonk/utils/plot-scale";
import { useExtracted } from "next-intl";
import {
  type ModelValues,
  eventCombinations,
  othersMoved,
  outputCurve,
  stableDomain,
  startingValues,
} from "../_utils/formula-model";
import { type PlotPoint } from "../_utils/sample-formula";
import { type ActivityRendererProps } from "../activity-renderer";

type Content = ActivityRendererProps<"formulaModel">["content"];
type Fields = Content["fields"];
type Variable = Fields["variables"][number];
export type Output = Fields["outputs"][number];

type Baseline = { kind: "start" | "whatIf"; values: ModelValues };

/** Every what-if switched off, as the model starts. */
export function eventsOff(fields: Fields): Record<string, number> {
  return Object.fromEntries((fields.events ?? []).map((event) => [event.name, 0]));
}

/**
 * The model's state the learner compares with: before the what-ifs switched on (the same sliders,
 * every event off), or else where the sliders started, once a slider other than the chart's moved.
 */
function baselineValues({
  axisName,
  events,
  fields,
  sliders,
}: {
  axisName: string;
  events: ModelValues;
  fields: Fields;
  sliders: ModelValues;
}): Baseline | null {
  if (Object.values(events).some((value) => value === 1)) {
    return { kind: "whatIf", values: { ...sliders, ...eventsOff(fields) } };
  }

  const moved = othersMoved({ except: axisName, values: sliders, variables: fields.variables });

  return moved
    ? { kind: "start", values: { ...startingValues(fields.variables), ...events } }
    : null;
}

/** The readouts compare with the start as soon as any slider moved, the chart's own included. */
function readoutBaselineValues({
  baseline,
  events,
  fields,
  sliders,
}: {
  baseline: Baseline | null;
  events: ModelValues;
  fields: Fields;
  sliders: ModelValues;
}): Baseline | null {
  if (baseline?.kind === "whatIf") {
    return baseline;
  }

  const moved = fields.variables.some((variable) => sliders[variable.name] !== variable.initial);

  return moved
    ? { kind: "start", values: { ...startingValues(fields.variables), ...events } }
    : null;
}

export type ModelView = {
  activeLabels: string[];
  /** What the chart's dashed curve keeps: before the what-ifs, or where other sliders started. */
  baseline: Baseline | null;
  baselineCurve: PlotPoint[] | null;
  chartedBefore: number | null;
  chartedNow: number | null;
  /** The comparison the writer marked: the plotted slider's value and the output there. */
  compared: { x: number; y: number } | null;
  current: PlotPoint[];
  /** How much the what-ifs changed the charted output at the slider. */
  delta: number;
  now: ModelValues;
  /** What the readouts compare with: before the what-ifs, or the start once any slider moved. */
  readoutBaseline: Baseline | null;
  x: number;
  /** One scale for every curve the learner can reach by flipping what-ifs. */
  yDomain: NumericDomain;
};

/** Everything the chart and readouts draw for the sliders and what-ifs where they are now. */
export function modelView({
  axis,
  charted,
  content,
  events,
  outputAt,
  sliders,
}: {
  axis: Variable;
  charted: Output;
  content: Content;
  events: ModelValues;
  outputAt: (output: Output, at: ModelValues) => number | null;
  sliders: ModelValues;
}): ModelView {
  const { fields } = content;
  const now = { ...sliders, ...events };
  const x = sliders[axis.name] ?? axis.initial;
  const baseline = baselineValues({ axisName: axis.name, events, fields, sliders });

  const curveAt = (values: ModelValues) =>
    outputCurve({ formula: charted.formula, values, variable: axis });

  const baselineCurve = baseline ? curveAt(baseline.values) : null;
  const chartedNow = outputAt(charted, now);
  const chartedBefore = baseline ? outputAt(charted, { ...baseline.values, [axis.name]: x }) : null;

  const everyCurve = eventCombinations((fields.events ?? []).map((event) => event.name)).map(
    (combination) => curveAt({ ...sliders, ...combination }),
  );

  const comparedY =
    fields.compareAt === undefined
      ? null
      : outputAt(charted, { ...now, [axis.name]: fields.compareAt });

  return {
    activeLabels: (fields.events ?? [])
      .filter((event) => events[event.name] === 1)
      .map((event) => event.label),
    baseline,
    baselineCurve,
    chartedBefore,
    chartedNow,
    compared:
      fields.compareAt === undefined || comparedY === null
        ? null
        : { x: fields.compareAt, y: comparedY },
    current: curveAt(now),
    delta:
      baseline?.kind === "whatIf" && chartedNow !== null && chartedBefore !== null
        ? chartedNow - chartedBefore
        : 0,
    now,
    readoutBaseline: readoutBaselineValues({ baseline, events, fields, sliders }),
    x,
    yDomain: stableDomain([...everyCurve, baselineCurve ?? []]),
  };
}

/**
 * The outputs as readouts: each one's value now, with how it changed since the start or since
 * before the what-ifs.
 */
export function useModelReadouts({
  charted,
  formatOutput,
  outputAt,
  outputs,
  view,
}: {
  charted: Output;
  formatOutput: (output: Output, value: number | null) => string;
  outputAt: (output: Output, at: ModelValues) => number | null;
  outputs: readonly Output[];
  view: ModelView;
}) {
  const t = useExtracted();
  const format = useFormatNumber();
  const baseline = view.readoutBaseline;

  function changeNote(output: Output, value: number, before: number) {
    return baseline?.kind === "whatIf"
      ? t("{value} before", { value: formatOutput(output, before) })
      : t("{change} from the start", {
          change: format(value - before, { signed: true, unit: output.unit }),
        });
  }

  return outputs.map((output) => {
    const value = outputAt(output, view.now);
    const before = baseline ? outputAt(output, baseline.values) : null;
    const hasChanged = value !== null && before !== null && value !== before;

    return {
      id: output.id,
      isPrimary: output.id === charted.id,
      label: output.label,
      note: hasChanged ? changeNote(output, value, before) : null,
      value: formatOutput(output, value),
    };
  });
}

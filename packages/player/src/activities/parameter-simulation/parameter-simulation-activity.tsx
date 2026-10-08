"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { useExtracted } from "next-intl";
import { useState } from "react";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityReadout,
} from "../_components/activity-canvas";
import { ActivitySlider } from "../_components/activity-slider";
import { computeActivityValue } from "../_utils/compute-activity-value";
import { startingValues } from "../_utils/formula-model";
import { type ActivityRendererProps } from "../activity-renderer";
import { checkValues, curvePeak, othersDiffer, sweepCurve } from "./parameter-model";
import { OtherOutputs, SimulationTextAlternative, StartingCurveNote } from "./simulation-parts";
import { SimulationPlot } from "./simulation-plot";

type ParameterSimulationProps = ActivityRendererProps<"parameterSimulation">;
type Content = ParameterSimulationProps["content"];
type Output = Content["fields"]["outputs"][number];

/** Where the check's answer sits: its slider positions and the value code computed for them. */
function expectedTarget(content: Content, expected: ParameterSimulationProps["expected"]) {
  const { check, fields } = content;

  if (check.kind !== "numeric" || expected?.kind !== "numeric") {
    return null;
  }

  const output = check.output ?? fields.plot.y;

  return output === fields.plot.y
    ? { value: expected.value, values: checkValues(fields.variables, check.inputs) }
    : null;
}

function useOutputs(content: Content) {
  const format = useFormatNumber();

  return {
    at: (output: Output, values: Readonly<Record<string, number>>) =>
      computeActivityValue(content, { inputs: values, output: output.id }),
    format: (output: Output, value: number | null) =>
      value === null ? "" : format(value, { unit: output.unit }),
  };
}

/**
 * A model to play with, like a projectile or a pendulum: the learner moves its parameters and
 * watches every output change, with the plotted output drawn across the x slider's whole range.
 * When another slider moves, the starting curve stays behind as a dashed line to compare with.
 */
export function ParameterSimulationActivity({
  content,
  expected,
  labelId,
  onAnswerChange,
  phase,
}: ParameterSimulationProps) {
  const t = useExtracted();
  const format = useFormatNumber();
  const outputs = useOutputs(content);
  const { check, fields } = content;
  const [values, setValues] = useState(() => startingValues(fields.variables));
  const x = fields.variables.find((variable) => variable.name === fields.plot.x);
  const plotted = fields.outputs.find((output) => output.id === fields.plot.y);

  if (!x || !plotted) {
    return null;
  }

  const initial = startingValues(fields.variables);
  const curve = sweepCurve({ formula: plotted.formula, values, x });
  const current = outputs.at(plotted, values);
  const target = phase === "checked" ? expectedTarget(content, expected) : null;
  const peak = curvePeak(curve);
  const others = fields.variables.filter((variable) => variable.name !== x.name);
  const hasMoved = othersDiffer({ first: initial, second: values, xName: x.name });

  const formatSlider = (name: string, value: number) =>
    format(value, { unit: fields.variables.find((variable) => variable.name === name)?.unit });

  /** The sliders other than the plotted one, like "Speed 20 m/s". */
  const settingsText = (settings: Readonly<Record<string, number>>) =>
    others
      .map(
        (variable) =>
          `${variable.label} ${formatSlider(variable.name, settings[variable.name] ?? variable.initial)}`,
      )
      .join(", ");

  const readings = fields.outputs.map((output) => ({
    id: output.id,
    label: output.label,
    value: outputs.format(output, outputs.at(output, values)),
  }));

  function handleChange(name: string, value: number) {
    const next = { ...values, [name]: value };
    setValues(next);

    if (check.kind === "numeric") {
      const answer = computeActivityValue(content, {
        inputs: next,
        output: check.output ?? fields.plot.y,
      });

      onAnswerChange(answer === null ? null : { kind: "numeric", value: answer });
    }
  }

  return (
    <ActivityCanvas labelId={labelId}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <ActivityCanvasLabel>{fields.model}</ActivityCanvasLabel>
          <ActivityCanvasLabel className="text-foreground text-sm">
            {plotted.label}
          </ActivityCanvasLabel>
        </div>

        <ActivityReadout aria-hidden="true" className="text-viz-accent">
          {outputs.format(plotted, current)}
        </ActivityReadout>
      </div>

      <OtherOutputs readings={readings.filter((reading) => reading.id !== plotted.id)} />

      <SimulationPlot
        current={current === null ? null : { x: values[x.name] ?? x.initial, y: current }}
        curve={curve}
        formatX={(value) => formatSlider(x.name, value)}
        formatY={(value) => outputs.format(plotted, value)}
        starting={hasMoved ? sweepCurve({ formula: plotted.formula, values: initial, x }) : null}
        target={
          target
            ? {
                curve: othersDiffer({ first: target.values, second: values, xName: x.name })
                  ? sweepCurve({ formula: plotted.formula, values: target.values, x })
                  : null,
                point: { x: target.values[x.name] ?? x.initial, y: target.value },
              }
            : null
        }
        x={x}
      />

      {hasMoved && <StartingCurveNote settings={settingsText(initial)} />}

      <div className="flex flex-col gap-3">
        {fields.variables.map((variable) => (
          <ActivitySlider
            disabled={phase === "checked"}
            key={variable.name}
            label={variable.label}
            max={variable.max}
            maxLabel={formatSlider(variable.name, variable.max)}
            min={variable.min}
            minLabel={formatSlider(variable.name, variable.min)}
            onValueChange={(value) => handleChange(variable.name, value)}
            step={variable.step}
            value={values[variable.name] ?? variable.initial}
            valueLabel={formatSlider(variable.name, values[variable.name] ?? variable.initial)}
            valueText={t("{input}. {output}: {value}", {
              input: formatSlider(variable.name, values[variable.name] ?? variable.initial),
              output: plotted.label,
              value: outputs.format(plotted, current),
            })}
          />
        ))}
      </div>

      <SimulationTextAlternative
        held={settingsText(values)}
        model={fields.model}
        output={plotted.label}
        peak={peak ? { x: formatSlider(x.name, peak.x), y: outputs.format(plotted, peak.y) } : null}
        range={{ max: formatSlider(x.name, x.max), min: formatSlider(x.name, x.min) }}
        readings={readings}
        variable={x.label}
      />
    </ActivityCanvas>
  );
}

"use client";

import { useExtracted } from "next-intl";
import { useState } from "react";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityReadout,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import {
  ActivityPlot,
  ActivityPlotArea,
  ActivityPlotAxisX,
  ActivityPlotDot,
  ActivityPlotGridY,
  ActivityPlotGuide,
  ActivityPlotLine,
} from "../_components/activity-plot";
import { ActivitySlider } from "../_components/activity-slider";
import { computeActivityValue } from "../_utils/compute-activity-value";
import { niceDomain, niceTicks } from "../_utils/plot-scale";
import { sampleFormula } from "../_utils/sample-formula";
import { useFormatNumber } from "../_utils/use-format-number";
import { type ActivityRendererProps } from "../activity-renderer";

const PLOT_HEIGHT = 168;
const COMPARE_DOT_RADIUS = 4.5;
const EXPECTED_DOT_RADIUS = 7;
const COMPACT_FROM = 10_000;

type SliderGraphProps = ActivityRendererProps<"sliderGraph">;

function useOutputAt(content: SliderGraphProps["content"]) {
  const { name } = content.fields.variable;
  return (input: number) => computeActivityValue(content, { inputs: { [name]: input } });
}

/** Where the check's answer sits on the curve: the slider position its inputs name. */
function expectedPoint(
  content: SliderGraphProps["content"],
  expected: SliderGraphProps["expected"],
) {
  const { check, fields } = content;

  const input =
    check.kind === "numeric"
      ? check.inputs?.find((item) => item.name === fields.variable.name)
      : undefined;

  return expected?.kind === "numeric" && input ? { x: input.value, y: expected.value } : null;
}

/**
 * A formula's output redrawn as the learner moves one input. Code samples the curve with core's
 * evaluator and reads the output at the slider, so the graph and the check always agree. With a
 * numeric check the output at the slider is the learner's answer.
 */
export function SliderGraphActivity({
  content,
  expected,
  labelId,
  onAnswerChange,
  phase,
}: SliderGraphProps) {
  const t = useExtracted();
  const format = useFormatNumber();
  const outputAt = useOutputAt(content);
  const { compareAt, formula, output, variable } = content.fields;
  const [input, setInput] = useState(variable.initial);

  const curve = sampleFormula({
    domain: [variable.min, variable.max],
    formula,
    variable: variable.name,
  });

  const yDomain = niceDomain(curve.map((point) => point.y));
  const current = outputAt(input);
  const compared = compareAt === undefined ? null : outputAt(compareAt);
  const target = phase === "checked" ? expectedPoint(content, expected) : null;
  const compact = Math.max(Math.abs(yDomain[0]), Math.abs(yDomain[1])) >= COMPACT_FROM;

  const formatInput = (value: number) => format(value, { unit: variable.unit });

  const formatOutput = (value: number | null) =>
    value === null ? "" : format(value, { unit: output.unit });

  function handleChange(next: number) {
    setInput(next);

    if (content.check.kind === "numeric") {
      const value = outputAt(next);
      onAnswerChange(value === null ? null : { kind: "numeric", value });
    }
  }

  return (
    <ActivityCanvas labelId={labelId}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <ActivityCanvasLabel className="text-sm">{output.label}</ActivityCanvasLabel>

          {compareAt !== undefined && compared !== null && (
            <ActivityCanvasLabel aria-hidden="true" className="tabular-nums">
              {t("At {input}: {value}", {
                input: formatInput(compareAt),
                value: formatOutput(compared),
              })}
            </ActivityCanvasLabel>
          )}
        </div>

        <ActivityReadout aria-hidden="true" className="text-viz-accent">
          {formatOutput(current)}
        </ActivityReadout>
      </div>

      <ActivityPlot height={PLOT_HEIGHT} xDomain={[variable.min, variable.max]} yDomain={yDomain}>
        <ActivityPlotGridY
          format={(value) => format(value, { compact, unit: output.unit })}
          ticks={niceTicks(yDomain, 3)}
        />
        <ActivityPlotAxisX format={formatInput} ticks={[variable.min, variable.max]} />
        <ActivityPlotArea points={curve} />
        <ActivityPlotLine points={curve} />

        {compareAt !== undefined && compared !== null && (
          <ActivityPlotDot
            className="fill-viz-accent-soft stroke-viz-accent"
            radius={COMPARE_DOT_RADIUS}
            x={compareAt}
            y={compared}
          />
        )}

        {target && (
          <ActivityPlotDot
            className="fill-success"
            radius={EXPECTED_DOT_RADIUS}
            x={target.x}
            y={target.y}
          />
        )}

        {current !== null && (
          <>
            <ActivityPlotGuide x={input} y={current} />
            <ActivityPlotDot x={input} y={current} />
          </>
        )}
      </ActivityPlot>

      <ActivitySlider
        disabled={phase === "checked"}
        label={variable.label}
        max={variable.max}
        maxLabel={formatInput(variable.max)}
        min={variable.min}
        minLabel={formatInput(variable.min)}
        onValueChange={handleChange}
        step={variable.step}
        value={input}
        valueLabel={formatInput(input)}
        valueText={t("{input}. {output}: {value}", {
          input: formatInput(input),
          output: output.label,
          value: formatOutput(current),
        })}
      />

      <ActivityTextAlternative>
        {t(
          "A graph of {output} as {variable} goes from {min} to {max}: it goes from {start} to {end}. At {input}, {output} is {value}.",
          {
            end: formatOutput(outputAt(variable.max)),
            input: formatInput(input),
            max: formatInput(variable.max),
            min: formatInput(variable.min),
            output: output.label,
            start: formatOutput(outputAt(variable.min)),
            value: formatOutput(current),
            variable: variable.label,
          },
        )}{" "}
        {compareAt !== undefined &&
          t("For comparison, at {input} it's {value}.", {
            input: formatInput(compareAt),
            value: formatOutput(compared),
          })}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}

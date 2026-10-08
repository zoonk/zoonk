"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { ActivityFormulaChart } from "../_components/activity-formula-chart";
import { ActivityModelSliders } from "../_components/activity-model-sliders";
import {
  ActivityOutputReadouts,
  useReadoutSentences,
} from "../_components/activity-output-readouts";
import { computeActivityValue } from "../_utils/compute-activity-value";
import {
  type ModelValues,
  othersMoved,
  outputCurve,
  primaryOutput,
  stableDomain,
  startingValues,
} from "../_utils/formula-model";
import { type ActivityRendererProps } from "../activity-renderer";

type SliderCalculatorProps = ActivityRendererProps<"sliderCalculator">;
type Output = SliderCalculatorProps["content"]["fields"]["outputs"][number];

/** Where the check's answer sits on the chart, once checked. */
function expectedPoint(
  content: SliderCalculatorProps["content"],
  expected: SliderCalculatorProps["expected"],
) {
  const [axis] = content.fields.variables;
  const { check } = content;

  const input =
    check.kind === "numeric" ? check.inputs?.find((item) => item.name === axis?.name) : undefined;

  return expected?.kind === "numeric" && input ? { x: input.value, y: expected.value } : null;
}

/**
 * A calculator with sliders, like an extra monthly payment on a loan: every output updates as
 * the learner moves a slider, next to where it started, and the chart shows the output the check
 * is about across the first slider's range. Values come from core's formula hooks, so the
 * readouts and a numeric check always agree.
 */
export function SliderCalculatorActivity({
  content,
  expected,
  labelId,
  onAnswerChange,
  phase,
}: SliderCalculatorProps) {
  const t = useExtracted();
  const format = useFormatNumber();
  const readoutSentences = useReadoutSentences();
  const { check, fields } = content;
  const start = startingValues(fields.variables);
  const [values, setValues] = useState<ModelValues>(start);
  const primary = primaryOutput(content);
  const [axis] = fields.variables;

  const outputAt = (output: Output, at: ModelValues) =>
    computeActivityValue(content, { inputs: at, output: output.id });

  const formatOutput = (output: Output, value: number | null) =>
    value === null ? "" : format(value, { unit: output.unit });

  function handleChange(name: string, value: number) {
    const next = { ...values, [name]: value };
    setValues(next);

    if (check.kind === "numeric") {
      const answer = computeActivityValue(content, { inputs: next, output: check.output });
      onAnswerChange(answer === null ? null : { kind: "numeric", value: answer });
    }
  }

  if (!primary || !axis) {
    return null;
  }

  const x = values[axis.name] ?? axis.initial;
  const current = outputCurve({ formula: primary.formula, values, variable: axis });
  const moved = othersMoved({ except: axis.name, values, variables: fields.variables });

  const baseline = moved
    ? outputCurve({ formula: primary.formula, values: start, variable: axis })
    : null;

  const readouts = fields.outputs.map((output) => {
    const [now, before] = [outputAt(output, values), outputAt(output, start)];
    const change = now !== null && before !== null ? now - before : 0;

    return {
      id: output.id,
      isPrimary: output.id === primary.id,
      label: output.label,
      note:
        change === 0
          ? null
          : t("{change} from the start", {
              change: format(change, { signed: true, unit: output.unit }),
            }),
      value: formatOutput(output, now),
    };
  });

  const primaryNow = outputAt(primary, values);

  return (
    <ActivityCanvas labelId={labelId}>
      <ActivityOutputReadouts items={readouts} />

      <ActivityFormulaChart
        baseline={
          baseline ? { points: baseline, y: outputAt(primary, { ...start, [axis.name]: x }) } : null
        }
        current={{ points: current, y: primaryNow }}
        deltaLabel={null}
        expected={phase === "checked" ? expectedPoint(content, expected) : null}
        formatTick={(value) => format(value, { compact: true, unit: primary.unit })}
        formatX={(value) => format(value, { unit: axis.unit })}
        x={x}
        xDomain={[axis.min, axis.max]}
        yDomain={stableDomain([current, baseline ?? []])}
      />

      <ActivityModelSliders
        disabled={phase === "checked"}
        onChange={handleChange}
        output={{ label: primary.label, value: formatOutput(primary, primaryNow) }}
        values={values}
        variables={fields.variables}
      />

      <ActivityTextAlternative>
        {t("A calculator with sliders and a chart of {output} across {variable}.", {
          output: primary.label,
          variable: axis.label,
        })}{" "}
        {readoutSentences(readouts)}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}

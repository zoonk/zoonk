"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ActivityCanvas, ActivityCanvasLabel } from "../_components/activity-canvas";
import { ActivityFormulaChart } from "../_components/activity-formula-chart";
import { ActivityModelSliders } from "../_components/activity-model-sliders";
import { ActivityOutputReadouts } from "../_components/activity-output-readouts";
import { computeActivityValue } from "../_utils/compute-activity-value";
import { type ModelValues, startingValues } from "../_utils/formula-model";
import { type ActivityRendererProps } from "../activity-renderer";
import { FormulaModelDescription } from "./formula-model-description";
import { FormulaModelEvents, FormulaModelLegend } from "./formula-model-events";
import { type Output, eventsOff, modelView, useModelReadouts } from "./formula-model-view";

type FormulaModelProps = ActivityRendererProps<"formulaModel">;
type Content = FormulaModelProps["content"];
type Fields = Content["fields"];

/** The output the chart draws: the one the check reads, the plotted one, or the first. */
function chartedOutput({ check, fields }: Content): Output | undefined {
  const asked = check.kind === "interaction" ? undefined : check.output;
  const id = asked ?? fields.plot?.y;

  return fields.outputs.find((output) => output.id === id) ?? fields.outputs[0];
}

/** The slider the chart sweeps: the plot's x, or the first slider. */
function chartAxis(fields: Fields) {
  return (
    fields.variables.find((variable) => variable.name === fields.plot?.x) ?? fields.variables[0]
  );
}

/** Where the check's answer sits on the chart, once checked: its slider positions and value. */
function expectedPoint({
  axis,
  content,
  expected,
}: {
  axis: Fields["variables"][number];
  content: Content;
  expected: FormulaModelProps["expected"];
}) {
  const { check } = content;

  if (check.kind !== "numeric" || expected?.kind !== "numeric") {
    return null;
  }

  const input = check.inputs?.find((item) => item.name === axis.name);
  return { x: input?.value ?? axis.initial, y: expected.value };
}

/**
 * A model of formulas to play with: sliders drive the outputs, and one output is drawn across one
 * slider's range (money growing at a rate, where a thrown ball lands, a loan paid off sooner, a
 * coffee cart's profit). What-ifs switch on and off over the sliders. A dashed curve keeps how
 * things were before the what-ifs, or where the sliders started, so the chart shows what a change
 * did. Values come from core's formula hooks, so the readouts and a numeric check always agree.
 */
export function FormulaModelActivity(props: FormulaModelProps) {
  const charted = chartedOutput(props.content);
  const axis = chartAxis(props.content.fields);

  return charted && axis ? <FormulaModelBoard {...props} axis={axis} charted={charted} /> : null;
}

function FormulaModelBoard({
  axis,
  charted,
  content,
  expected,
  labelId,
  onAnswerChange,
  phase,
}: FormulaModelProps & { axis: Fields["variables"][number]; charted: Output }) {
  const t = useExtracted();
  const format = useFormatNumber();
  const { check, fields } = content;
  const [sliders, setSliders] = useState<ModelValues>(() => startingValues(fields.variables));
  const [events, setEvents] = useState<ModelValues>(() => eventsOff(fields));
  const isChecked = phase === "checked";

  const outputAt = (output: Output, at: ModelValues) =>
    computeActivityValue(content, { inputs: at, output: output.id });

  const formatOutput = (output: Output, value: number | null) =>
    value === null ? "" : format(value, { unit: output.unit });

  const formatX = (value: number) => format(value, { unit: axis.unit });

  function update(nextSliders: ModelValues, nextEvents: ModelValues) {
    setSliders(nextSliders);
    setEvents(nextEvents);

    if (check.kind === "numeric") {
      const inputs = { ...nextSliders, ...nextEvents };
      const answer = computeActivityValue(content, { inputs, output: check.output });
      onAnswerChange(answer === null ? null : { kind: "numeric", value: answer });
    }
  }

  const view = modelView({ axis, charted, content, events, outputAt, sliders });

  const readouts = useModelReadouts({
    charted,
    formatOutput,
    outputAt,
    outputs: fields.outputs,
    view,
  });

  return (
    <ActivityCanvas labelId={labelId}>
      {fields.title && <ActivityCanvasLabel>{fields.title}</ActivityCanvasLabel>}

      {fields.events && fields.events.length > 0 && (
        <FormulaModelEvents
          disabled={isChecked}
          events={fields.events}
          onToggle={(name) => update(sliders, { ...events, [name]: events[name] === 1 ? 0 : 1 })}
          values={events}
        />
      )}

      <ActivityOutputReadouts items={readouts} />

      {view.compared && (
        <ActivityCanvasLabel aria-hidden="true" className="tabular-nums">
          {t("{output} at {input}: {value}", {
            input: formatX(view.compared.x),
            output: charted.label,
            value: formatOutput(charted, view.compared.y),
          })}
        </ActivityCanvasLabel>
      )}

      <ActivityFormulaChart
        baseline={view.baselineCurve ? { points: view.baselineCurve, y: view.chartedBefore } : null}
        compare={view.compared}
        current={{ points: view.current, y: view.chartedNow }}
        deltaLabel={
          view.delta === 0 ? null : format(view.delta, { signed: true, unit: charted.unit })
        }
        expected={isChecked ? expectedPoint({ axis, content, expected }) : null}
        formatTick={(value) => format(value, { compact: true, unit: charted.unit })}
        formatX={formatX}
        x={view.x}
        xDomain={[axis.min, axis.max]}
        yDomain={view.yDomain}
      />

      {view.baseline && <FormulaModelLegend kind={view.baseline.kind} />}

      <ActivityModelSliders
        disabled={isChecked}
        onChange={(name, value) => update({ ...sliders, [name]: value }, events)}
        output={{ label: charted.label, value: formatOutput(charted, view.chartedNow) }}
        values={sliders}
        variables={fields.variables}
      />

      <FormulaModelDescription
        axis={axis.label}
        compared={
          view.compared
            ? { x: formatX(view.compared.x), y: formatOutput(charted, view.compared.y) }
            : null
        }
        events={fields.events && fields.events.length > 0 ? view.activeLabels : null}
        output={charted.label}
        readouts={readouts}
      />
    </ActivityCanvas>
  );
}

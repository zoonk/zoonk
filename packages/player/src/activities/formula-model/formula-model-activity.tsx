"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ActivityCanvas, ActivityCanvasLabel } from "../_components/activity-canvas";
import { exactAnswerFormat } from "../_components/activity-feedback";
import { ActivityFormulaChart } from "../_components/activity-formula-chart";
import { ActivityModelSliders } from "../_components/activity-model-sliders";
import { ActivityOutputReadouts } from "../_components/activity-output-readouts";
import { computeActivityValue } from "../_utils/compute-activity-value";
import { type ModelValues } from "../_utils/formula-model";
import { type ActivityRendererProps } from "../activity-renderer";
import { FormulaModelDescription } from "./formula-model-description";
import { FormulaModelEvents, FormulaModelLegend } from "./formula-model-events";
import {
  type Output,
  changeFormat,
  modelView,
  startingModel,
  useModelReadouts,
} from "./formula-model-view";

type FormulaModelProps = ActivityRendererProps<"formulaModel">;
type Content = FormulaModelProps["content"];
type Fields = Content["fields"];

function chartedOutput({ check, fields }: Content): Output | undefined {
  const asked = check.kind === "interaction" ? undefined : check.output;
  const id = asked ?? fields.plot?.y;

  return fields.outputs.find((output) => output.id === id) ?? fields.outputs[0];
}

function chartAxis(fields: Fields) {
  return (
    fields.variables.find((variable) => variable.name === fields.plot?.x) ?? fields.variables[0]
  );
}

function expectedPoint({
  axis,
  content,
  expected,
  formatOutput,
}: {
  axis: Fields["variables"][number];
  content: Content;
  expected: FormulaModelProps["expected"];
  formatOutput: (value: number) => string;
}) {
  const { check } = content;

  if (check.kind !== "numeric" || expected?.kind !== "numeric") {
    return null;
  }

  const input = check.inputs?.findLast((item) => item.name === axis.name);

  return {
    label: formatOutput(expected.value),
    x: input?.value ?? axis.initial,
    y: expected.value,
  };
}

export function FormulaModelActivity(props: FormulaModelProps) {
  const charted = chartedOutput(props.content);
  const axis = chartAxis(props.content.fields);

  return charted && axis ? <FormulaModelBoard {...props} axis={axis} charted={charted} /> : null;
}

function FormulaModelBoard({
  answer,
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
  const [model, setModel] = useState(() => startingModel({ content, phase }));
  const { events, sliders } = model;
  const isChecked = phase === "checked";

  const outputAt = (output: Output, at: ModelValues) =>
    computeActivityValue(content, { inputs: at, output: output.id });

  const answerFormat =
    check.kind === "numeric" &&
    exactAnswerFormat({
      check,
      value: isChecked && answer?.kind === "numeric" ? answer.value : undefined,
    });

  const formatOutput = (output: Output, value: number | null) =>
    value === null
      ? ""
      : format(value, {
          maximumFractionDigits:
            output.id === charted.id && answerFormat
              ? answerFormat.maximumFractionDigits
              : undefined,
          unit:
            output.unit ??
            (output.id === charted.id && answerFormat ? answerFormat.unit : undefined),
        });

  const formatX = (value: number) => format(value, { unit: axis.unit });

  function update(nextSliders: ModelValues, nextEvents: ModelValues) {
    setModel({ events: nextEvents, sliders: nextSliders });

    if (check.kind === "numeric") {
      const inputs = { ...nextSliders, ...nextEvents };
      const value = computeActivityValue(content, { inputs, output: check.output });
      onAnswerChange(value === null ? null : { kind: "numeric", value });
    }
  }

  const view = modelView({ axis, charted, content, events, outputAt, sliders });

  const readouts = useModelReadouts({ charted, formatOutput, view });

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

      <ActivityOutputReadouts
        items={readouts.map((item) => ({ ...item, note: item.note ?? "\u00A0" }))}
      />

      <div className="flex flex-col gap-1">
        {/* At the compared input this line would repeat the readout, so it keeps its room and says nothing. */}
        {view.compared && (
          <ActivityCanvasLabel
            aria-hidden="true"
            className={cn("tabular-nums", view.compared.x === view.x && "invisible")}
          >
            {t("{output} at {input}: {value}", {
              input: formatX(view.compared.x),
              output: charted.label,
              value: formatOutput(charted, view.compared.y),
            })}
          </ActivityCanvasLabel>
        )}

        <ActivityFormulaChart
          baseline={
            view.baselineCurve ? { points: view.baselineCurve, y: view.chartedBefore } : null
          }
          compare={view.compared}
          current={{ points: view.current, y: view.chartedNow }}
          deltaLabel={
            view.delta && format(view.delta.amount, changeFormat(view.delta, charted.unit))
          }
          expected={
            isChecked
              ? expectedPoint({
                  axis,
                  content,
                  expected,
                  formatOutput: (value) => formatOutput(charted, value),
                })
              : null
          }
          formatTick={(value, isShort) => format(value, { compact: isShort, unit: charted.unit })}
          formatX={formatX}
          x={view.x}
          xDomain={[axis.min, axis.max]}
          xLabel={axis.label}
          yDomain={view.yDomain}
          yLabel={charted.label}
        />
      </div>

      {view.baseline && (
        <FormulaModelLegend activeLabels={view.activeLabels} kind={view.baseline.kind} />
      )}

      <ActivityModelSliders
        disabled={isChecked}
        onChange={(name, value) => update({ ...sliders, [name]: value }, events)}
        output={{ label: charted.label, value: formatOutput(charted, view.chartedNow) }}
        scaledAbove={axis.name}
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

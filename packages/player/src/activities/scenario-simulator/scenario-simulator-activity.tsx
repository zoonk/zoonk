"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { Check, Plus } from "lucide-react";
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
  eventCombinations,
  outputCurve,
  primaryOutput,
  stableDomain,
  startingValues,
} from "../_utils/formula-model";
import { useFormatNumber } from "../_utils/use-format-number";
import { type ActivityRendererProps } from "../activity-renderer";

type ScenarioProps = ActivityRendererProps<"scenarioSimulator">;
type Fields = ScenarioProps["content"]["fields"];
type Output = Fields["outputs"][number];

function eventsOff(fields: Fields): Record<string, number> {
  return Object.fromEntries(fields.events.map((event) => [event.name, 0]));
}

/** A what-if the learner switches on and off, like a toggle chip. */
function EventToggle({
  disabled,
  isOn,
  label,
  onToggle,
}: {
  disabled: boolean;
  isOn: boolean;
  label: string;
  onToggle: () => void;
}) {
  const Icon = isOn ? Check : Plus;

  return (
    <button
      aria-pressed={isOn}
      className={cn(
        "focus-visible:ring-ring/50 inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-[3px] motion-safe:transition-colors",
        isOn
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background hover:bg-accent",
      )}
      disabled={disabled}
      onClick={onToggle}
      type="button"
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}

/** The what-ifs as toggle chips; the badge above already says "What if". */
function ScenarioEvents({
  disabled,
  events,
  onToggle,
  values,
}: {
  disabled: boolean;
  events: Fields["events"];
  onToggle: (name: string) => void;
  values: ModelValues;
}) {
  const t = useExtracted();

  return (
    <div aria-label={t("What-if events")} className="flex flex-wrap gap-2" role="group">
      {events.map((event) => (
        <EventToggle
          disabled={disabled}
          isOn={values[event.name] === 1}
          key={event.name}
          label={event.label}
          onToggle={() => onToggle(event.name)}
        />
      ))}
    </div>
  );
}

/** Tells the solid curve (with the what-ifs) from the dashed one (before them). */
function BeforeLegend() {
  const t = useExtracted();

  return (
    <div
      aria-hidden="true"
      className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs"
    >
      <span className="flex items-center gap-1.5">
        <span className="bg-viz-accent h-0.5 w-4 rounded-full" />
        {t("With the what-ifs")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="border-muted-foreground w-4 border-t-2 border-dashed" />
        {t("Before")}
      </span>
    </div>
  );
}

/**
 * "What if" for a small business: the learner turns events on and off (higher rent, pricier
 * milk) while moving levers, and sees what each event does to the outputs next to how things
 * were before it. The chart keeps one scale for every combination of events, so switching one
 * visibly moves the curve. Values come from core's formula hooks, like the check's.
 */
export function ScenarioSimulatorActivity({
  content,
  labelId,
  onAnswerChange,
  phase,
}: ScenarioProps) {
  const t = useExtracted();
  const format = useFormatNumber();
  const readoutSentences = useReadoutSentences();
  const { check, fields } = content;
  const [sliders, setSliders] = useState<ModelValues>(() => startingValues(fields.variables));
  const [events, setEvents] = useState<ModelValues>(() => eventsOff(fields));
  const primary = primaryOutput(content);
  const [axis] = fields.variables;
  const isChecked = phase === "checked";

  const outputAt = (output: Output, at: ModelValues) =>
    computeActivityValue(content, { inputs: at, output: output.id });

  const formatOutput = (output: Output, value: number | null) =>
    value === null ? "" : format(value, { unit: output.unit });

  function update(nextSliders: ModelValues, nextEvents: ModelValues) {
    setSliders(nextSliders);
    setEvents(nextEvents);

    if (check.kind === "numeric") {
      const inputs = { ...nextSliders, ...nextEvents };
      const answer = computeActivityValue(content, { inputs, output: check.output });
      onAnswerChange(answer === null ? null : { kind: "numeric", value: answer });
    }
  }

  if (!primary || !axis) {
    return null;
  }

  const now = { ...sliders, ...events };
  const before = { ...sliders, ...eventsOff(fields) };
  const anyEventOn = Object.values(events).some((value) => value === 1);
  const current = outputCurve({ formula: primary.formula, values: now, variable: axis });

  const baseline = anyEventOn
    ? outputCurve({ formula: primary.formula, values: before, variable: axis })
    : null;

  const everyCurve = eventCombinations(fields.events.map((event) => event.name)).map(
    (combination) =>
      outputCurve({
        formula: primary.formula,
        values: { ...sliders, ...combination },
        variable: axis,
      }),
  );

  const [primaryNow, primaryBefore] = [outputAt(primary, now), outputAt(primary, before)];
  const change = primaryNow !== null && primaryBefore !== null ? primaryNow - primaryBefore : 0;

  const activeLabels = fields.events
    .filter((event) => events[event.name] === 1)
    .map((event) => event.label);

  const readouts = fields.outputs.map((output) => {
    const [value, previous] = [outputAt(output, now), outputAt(output, before)];

    return {
      id: output.id,
      isPrimary: output.id === primary.id,
      label: output.label,
      note:
        anyEventOn && previous !== null && previous !== value
          ? t("{value} before", { value: formatOutput(output, previous) })
          : null,
      value: formatOutput(output, value),
    };
  });

  return (
    <ActivityCanvas labelId={labelId}>
      <ScenarioEvents
        disabled={isChecked}
        events={fields.events}
        onToggle={(name) => update(sliders, { ...events, [name]: events[name] === 1 ? 0 : 1 })}
        values={events}
      />

      <ActivityOutputReadouts items={readouts} />

      <ActivityFormulaChart
        baseline={baseline ? { points: baseline, y: primaryBefore } : null}
        current={{ points: current, y: primaryNow }}
        deltaLabel={change === 0 ? null : format(change, { signed: true, unit: primary.unit })}
        expected={null}
        formatTick={(value) => format(value, { compact: true, unit: primary.unit })}
        formatX={(value) => format(value, { unit: axis.unit })}
        x={sliders[axis.name] ?? axis.initial}
        xDomain={[axis.min, axis.max]}
        yDomain={stableDomain(everyCurve)}
      />

      {baseline && <BeforeLegend />}

      <ActivityModelSliders
        disabled={isChecked}
        onChange={(name, value) => update({ ...sliders, [name]: value }, events)}
        output={{ label: primary.label, value: formatOutput(primary, primaryNow) }}
        values={sliders}
        variables={fields.variables}
      />

      <ActivityTextAlternative>
        {activeLabels.length > 0
          ? t("What ifs switched on: {events}.", { events: activeLabels.join(", ") })
          : t("No what ifs switched on.")}{" "}
        {readoutSentences(readouts)}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}

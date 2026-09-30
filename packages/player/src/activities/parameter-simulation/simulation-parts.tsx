"use client";

import { useExtracted } from "next-intl";
import { ActivityTextAlternative } from "../_components/activity-canvas";

type Reading = { id: string; label: string; value: string };

/** The outputs other than the plotted one, read live as the sliders move. */
export function OtherOutputs({ readings }: { readings: readonly Reading[] }) {
  if (readings.length === 0) {
    return null;
  }

  return (
    <dl aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
      {readings.map((reading) => (
        <div className="flex gap-1.5" key={reading.id}>
          <dt className="text-muted-foreground">{reading.label}</dt>
          <dd className="font-semibold">{reading.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** What the dashed curve is: the model before the other sliders moved. */
export function StartingCurveNote({ settings }: { settings: string }) {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground flex items-start gap-2 text-xs">
      <svg aria-hidden="true" className="h-lh w-5 shrink-0" viewBox="0 0 20 8">
        <path
          className="stroke-muted-foreground"
          d="M1 4 H19"
          strokeDasharray="4 3"
          strokeWidth={2}
        />
      </svg>
      {t("Dashed: at the start ({settings})", { settings })}
    </p>
  );
}

/** The graph in words: what's plotted, what's held, where it peaks and every output now. */
export function SimulationTextAlternative({
  held,
  model,
  output,
  peak,
  range,
  readings,
  variable,
}: {
  held: string;
  model: string;
  output: string;
  peak: { x: string; y: string } | null;
  range: { max: string; min: string };
  readings: readonly Reading[];
  variable: string;
}) {
  const t = useExtracted();

  return (
    <ActivityTextAlternative>
      {t("{model}: a graph of {output} as {variable} goes from {min} to {max}.", {
        max: range.max,
        min: range.min,
        model,
        output,
        variable,
      })}{" "}
      {held && t("Held at: {others}.", { others: held })}{" "}
      {peak && t("It's highest at {x}: {y}.", peak)}{" "}
      {readings.map((reading) => `${reading.label}: ${reading.value}`).join(". ")}
    </ActivityTextAlternative>
  );
}

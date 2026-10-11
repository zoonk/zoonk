"use client";

import { useExtracted } from "next-intl";
import { ActivityTextAlternative } from "../_components/activity-canvas";
import { useReadoutSentences } from "../_components/activity-output-readouts";

/** The model in words: what the chart draws, the what-ifs switched on and every output now. */
export function FormulaModelDescription({
  axis,
  compared,
  events,
  output,
  readouts,
}: {
  axis: string;
  /** The marked comparison, formatted: the slider's value and the output there. */
  compared: { x: string; y: string } | null;
  /** The what-ifs switched on, or null for a model without any. */
  events: readonly string[] | null;
  output: string;
  readouts: Parameters<ReturnType<typeof useReadoutSentences>>[0];
}) {
  const t = useExtracted();
  const readoutSentences = useReadoutSentences();

  function eventsText() {
    if (events === null) {
      return null;
    }

    return events.length > 0
      ? t("What ifs switched on: {events}.", { events: events.join(", ") })
      : t("No what ifs switched on.");
  }

  return (
    <ActivityTextAlternative>
      {t("Sliders and a chart of {output} across {variable}.", { output, variable: axis })}{" "}
      {eventsText()} {readoutSentences(readouts)}{" "}
      {compared &&
        t("For comparison, at {input} it's {value}.", { input: compared.x, value: compared.y })}
    </ActivityTextAlternative>
  );
}

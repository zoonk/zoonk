"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { ActivityCanvasLabel, ActivityReadout } from "./activity-canvas";

type Readout = {
  id: string;
  isPrimary: boolean;
  label: string;
  /** A comparison under the value, like "−84 months from the start". */
  note: string | null;
  value: string;
};

/**
 * The outputs a model computes, big enough to read at a glance: the one the check asks about in
 * the accent color, the rest beside it. Values are hidden from screen readers here because the
 * sliders announce them as they move and the text alternative describes them.
 */
export function ActivityOutputReadouts({ items }: { items: readonly Readout[] }) {
  return (
    <dl
      aria-hidden="true"
      className={cn("grid gap-x-4 gap-y-3", items.length > 1 ? "grid-cols-2" : "grid-cols-1")}
      data-slot="activity-output-readouts"
    >
      {items.map((item) => (
        <div className="flex min-w-0 flex-col gap-0.5" key={item.id}>
          <dt>
            <ActivityCanvasLabel className="text-sm">{item.label}</ActivityCanvasLabel>
          </dt>
          <dd className="flex flex-col gap-0.5">
            <ActivityReadout className={cn("wrap-break-word", item.isPrimary && "text-viz-accent")}>
              {item.value}
            </ActivityReadout>

            {item.note && (
              <ActivityCanvasLabel className="tabular-nums">{item.note}</ActivityCanvasLabel>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The readouts in words, for the canvas's text alternative. */
export function useReadoutSentences(): (items: readonly Readout[]) => string {
  const t = useExtracted();

  return function readoutSentences(items) {
    return items
      .map((item) =>
        item.note
          ? t("{output}: {value}, {note}.", {
              note: item.note,
              output: item.label,
              value: item.value,
            })
          : t("{output}: {value}.", { output: item.label, value: item.value }),
      )
      .join(" ");
  };
}

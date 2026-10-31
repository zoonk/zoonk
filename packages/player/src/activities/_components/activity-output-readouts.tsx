"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { ActivityCanvasLabel, ActivityReadout } from "./activity-canvas";

type Readout = {
  id: string;
  isPrimary: boolean;
  label: string;
  note: string | null;
  value: string;
};

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

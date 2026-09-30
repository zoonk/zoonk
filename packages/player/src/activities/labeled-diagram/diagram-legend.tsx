"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { DIAGRAM_TONES } from "../_assets/diagrams/diagram-tones";
import { type DiagramLegendKey, type DiagramTone } from "../_assets/diagrams/diagram-types";
import { useLegendLabel } from "./use-diagram-words";

/** What a drawing's colors mean, like blood low or rich in oxygen. */
export function DiagramLegend({
  items,
}: {
  items: readonly { key: DiagramLegendKey; tone: DiagramTone }[];
}) {
  const labelOf = useLegendLabel();

  return (
    <ul className="text-muted-foreground flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
      {items.map((item) => (
        <li className="flex items-center gap-1.5" key={item.key}>
          <svg aria-hidden="true" className="size-2.5" viewBox="0 0 10 10">
            <circle className={cn(DIAGRAM_TONES[item.tone].mark)} cx={5} cy={5} r={5} />
          </svg>
          {labelOf(item.key)}
        </li>
      ))}
    </ul>
  );
}

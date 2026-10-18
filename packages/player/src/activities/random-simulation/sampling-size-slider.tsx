"use client";

import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderLabel,
  SliderThumb,
  SliderTrack,
} from "@zoonk/ui/components/slider";
import { cn } from "@zoonk/ui/lib/utils";

const PERCENT = 100;

function edgeAlign(index: number, count: number): string {
  if (index === 0) {
    return "translate-x-0";
  }

  return index === count - 1 ? "-translate-x-full" : "-translate-x-1/2";
}

/**
 * Picks one of the lesson's sample sizes. The sizes sit at even steps, labeled under the track,
 * so a jump from 100 to 400 reads as one move, whatever the numbers.
 */
export function SamplingSizeSlider({
  disabled,
  index,
  label,
  onIndexChange,
  sizeLabels,
  valueText,
}: {
  disabled: boolean;
  index: number;
  label: string;
  onIndexChange: (index: number) => void;
  sizeLabels: readonly string[];
  valueText: string;
}) {
  const last = sizeLabels.length - 1;

  return (
    <Slider
      className="gap-0"
      disabled={disabled}
      max={last}
      min={0}
      onValueChange={(next) => onIndexChange(typeof next === "number" ? next : (next[0] ?? 0))}
      step={1}
      value={index}
    >
      <div className="flex items-baseline justify-between gap-3">
        <SliderLabel>{label}</SliderLabel>
        <span aria-hidden="true" className="text-sm font-semibold tabular-nums">
          {sizeLabels[index]}
        </span>
      </div>

      <SliderControl>
        <SliderTrack>
          <SliderIndicator className="bg-viz-accent" />
          <SliderThumb aria-valuetext={valueText} />
        </SliderTrack>
      </SliderControl>

      <div aria-hidden="true" className="text-muted-foreground relative h-4 text-xs tabular-nums">
        {sizeLabels.map((sizeLabel, position) => (
          <span
            className={cn(
              "absolute top-0 whitespace-nowrap",
              edgeAlign(position, sizeLabels.length),
              position === index && "text-foreground font-medium",
            )}
            key={sizeLabel}
            style={{ left: `${(position / Math.max(last, 1)) * PERCENT}%` }}
          >
            {sizeLabel}
          </span>
        ))}
      </div>
    </Slider>
  );
}

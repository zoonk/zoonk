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

/**
 * The slider every activity uses to change a value: its label and current value on top, the
 * range's ends underneath. `valueText` is what screen readers announce as it moves, so it should
 * name the value with its unit and anything the move changes, like the output it produces.
 */
export function ActivitySlider({
  className,
  disabled,
  label,
  max,
  maxLabel,
  min,
  minLabel,
  onValueChange,
  step,
  value,
  valueLabel,
  valueText,
}: {
  className?: string;
  disabled?: boolean;
  label: string;
  max: number;
  maxLabel: string;
  min: number;
  minLabel: string;
  onValueChange: (value: number) => void;
  step: number;
  value: number;
  valueLabel: string;
  valueText: string;
}) {
  return (
    <Slider
      className={cn("gap-0", className)}
      disabled={disabled}
      max={max}
      min={min}
      onValueChange={(next) => onValueChange(typeof next === "number" ? next : (next[0] ?? min))}
      step={step}
      value={value}
    >
      <div className="flex items-baseline justify-between gap-3">
        <SliderLabel>{label}</SliderLabel>
        <span aria-hidden="true" className="text-sm font-semibold tabular-nums">
          {valueLabel}
        </span>
      </div>

      <SliderControl>
        <SliderTrack>
          <SliderIndicator className="bg-viz-accent" />
          <SliderThumb aria-valuetext={valueText} />
        </SliderTrack>
      </SliderControl>

      <div
        aria-hidden="true"
        className="text-muted-foreground flex justify-between text-xs tabular-nums"
      >
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </Slider>
  );
}

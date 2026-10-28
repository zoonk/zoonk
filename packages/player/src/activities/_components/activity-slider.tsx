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

export function ActivitySlider({
  className,
  disabled,
  label,
  max,
  min,
  onValueChange,
  scale,
  step,
  value,
  valueLabel,
  valueText,
}: {
  className?: string;
  disabled?: boolean;
  label: string;
  max: number;
  min: number;
  onValueChange: (value: number) => void;
  scale: React.ReactNode;
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

      {scale}
    </Slider>
  );
}

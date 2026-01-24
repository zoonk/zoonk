"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { cn } from "@zoonk/ui/lib/utils";
import { useMemo } from "react";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) {
  const values = useMemo(() => {
    if (Array.isArray(value)) {
      return value;
    }

    if (Array.isArray(defaultValue)) {
      return defaultValue;
    }

    return [min, max];
  }, [value, defaultValue, min, max]);

  return (
    <SliderPrimitive.Root
      className="data-horizontal:w-full data-vertical:h-full"
      data-slot="slider"
      defaultValue={defaultValue}
      max={max}
      min={min}
      thumbAlignment="edge"
      value={value}
      {...props}
    >
      <SliderPrimitive.Control
        className={cn(
          "relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col",
          className,
        )}
      >
        <SliderPrimitive.Track
          className="bg-muted relative overflow-hidden rounded-4xl select-none data-horizontal:h-3 data-horizontal:w-full data-vertical:h-full data-vertical:w-3"
          data-slot="slider-track"
        >
          <SliderPrimitive.Indicator
            className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
            data-slot="slider-range"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            className="border-primary ring-ring/50 block size-4 shrink-0 rounded-4xl border bg-white shadow-sm transition-colors select-none hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
            data-slot="slider-thumb"
            key={index}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };

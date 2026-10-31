"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { cn } from "@zoonk/ui/lib/utils";

function Slider({ className, thumbAlignment = "edge", ...props }: SliderPrimitive.Root.Props) {
  return (
    <SliderPrimitive.Root
      className={cn("flex w-full flex-col gap-2 data-vertical:h-full", className)}
      data-slot="slider"
      thumbAlignment={thumbAlignment}
      {...props}
    />
  );
}

function SliderLabel({ className, ...props }: SliderPrimitive.Label.Props) {
  return (
    <SliderPrimitive.Label
      className={cn("text-sm font-medium", className)}
      data-slot="slider-label"
      {...props}
    />
  );
}

function SliderControl({ className, ...props }: SliderPrimitive.Control.Props) {
  return (
    <SliderPrimitive.Control
      className={cn(
        "relative flex h-11 w-full touch-none items-center select-none data-disabled:opacity-60",
        className,
      )}
      data-slot="slider-control"
      {...props}
    />
  );
}

function SliderTrack({ className, ...props }: SliderPrimitive.Track.Props) {
  return (
    <SliderPrimitive.Track
      className={cn("bg-muted relative h-2 w-full grow rounded-full select-none", className)}
      data-slot="slider-track"
      {...props}
    />
  );
}

function SliderIndicator({ className, ...props }: SliderPrimitive.Indicator.Props) {
  return (
    <SliderPrimitive.Indicator
      className={cn("bg-primary h-full rounded-full select-none", className)}
      data-slot="slider-indicator"
      {...props}
    />
  );
}

function SliderThumb({ className, ...props }: SliderPrimitive.Thumb.Props) {
  return (
    <SliderPrimitive.Thumb
      className={cn(
        "has-focus-visible:ring-ring/50 relative block size-7 shrink-0 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] ring-1 ring-black/10 transition-shadow select-none after:absolute after:-inset-2 has-focus-visible:ring-[3px] data-disabled:pointer-events-none",
        className,
      )}
      data-slot="slider-thumb"
      {...props}
    />
  );
}

export { Slider, SliderControl, SliderIndicator, SliderLabel, SliderThumb, SliderTrack };

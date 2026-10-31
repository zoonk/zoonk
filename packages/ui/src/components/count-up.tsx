"use client";

import { useCelebration } from "@zoonk/ui/hooks/celebration";
import { readDuration, readEasing } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";
import { useEffectEvent, useLayoutEffect, useRef } from "react";

/** The final value is on the page from the first frame for screen readers and layout; the counting digits draw over it. */
export function CountUp({
  className,
  delayMs = 0,
  format = String,
  value,
}: {
  className?: string;
  delayMs?: number;
  format?: (value: number) => string;
  value: number;
}) {
  const plays = useCelebration();
  const root = useRef<HTMLSpanElement>(null);
  const digits = useRef<HTMLSpanElement>(null);
  const write = useEffectEvent((count: number) => format(count));

  useLayoutEffect(() => {
    const wrapper = root.current;
    const overlay = digits.current;
    const duration = overlay ? readDuration(overlay, "fill") : 0;

    if (!plays || !wrapper || !overlay || duration === 0 || value === 0) {
      return;
    }

    // No keyframes: the browser's clock for the token's time and curve, read on every frame.
    const clock = overlay.animate([], {
      delay: delayMs,
      duration,
      easing: readEasing(overlay, "out"),
      fill: "both",
    });

    let frame = 0;
    let ended = false;

    // Blank until it starts, then never "+0", which reads as a loss: it rounds up from the start.
    const draw = () => {
      const progress = Math.min(1, clock.effect?.getComputedTiming().progress ?? 1);
      overlay.dataset.value = progress > 0 ? write(Math.ceil(value * progress)) : "";

      if (clock.playState === "running") {
        frame = requestAnimationFrame(draw);
      }
    };

    const end = () => {
      if (!ended) {
        ended = true;
        cancelAnimationFrame(frame);
        clock.cancel();
        delete wrapper.dataset.counting;
      }
    };

    wrapper.dataset.counting = "";
    draw();

    clock.finished.then(end, () => {
      // Canceled: `end` did it, and has nothing left to do.
    });

    return end;
  }, [delayMs, plays, value]);

  return (
    <span
      className={cn("group/count relative inline-block tabular-nums", className)}
      data-slot="count-up"
      ref={root}
    >
      <span className="group-data-counting/count:opacity-0">{format(value)}</span>
      <span
        aria-hidden="true"
        className="absolute inset-y-0 inset-s-0 hidden whitespace-nowrap group-data-counting/count:block before:content-[attr(data-value)]"
        ref={digits}
      />
    </span>
  );
}

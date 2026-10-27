"use client";

import { readDuration, readEasing } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";
import { useEffectEvent, useLayoutEffect, useRef } from "react";

/**
 * A number counting up to what was reached, once, when it's earned: the Brain Power a task or
 * the day earned (a positive number). The value is on the page from the first frame, so screen readers, tests
 * and the layout read it (its width held, the digits tabular); the counting digits draw over it
 * for the fill's time on the ease-out (`duration-fill`), in step with a meter filling beside it,
 * then give way to it. With reduced motion, or where the stylesheet isn't loaded, it shows the
 * value at once. Mount it with the moment the learner's action opened: a server-rendered page
 * paints the value before this runs.
 *
 * ```tsx
 * <CountUp format={(points) => `+${format.number(points)}`} value={27} />
 * ```
 */
export function CountUp({
  className,
  delay = 0,
  format = String,
  value,
}: {
  className?: string;
  /** Milliseconds before it counts: its beat in the moment's order. */
  delay?: number;
  /** Writes a number as the page shows it (`+27`, `1,240`), the same way at every step. */
  format?: (value: number) => string;
  value: number;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const digits = useRef<HTMLSpanElement>(null);
  const write = useEffectEvent((count: number) => format(count));

  useLayoutEffect(() => {
    const wrapper = root.current;
    const overlay = digits.current;
    const duration = overlay ? readDuration(overlay, "fill") : 0;

    if (!wrapper || !overlay || duration === 0 || value === 0) {
      return;
    }

    // No keyframes: the browser's clock for the token's time and curve, read on every frame.
    const clock = overlay.animate([], {
      delay,
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
  }, [delay, value]);

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

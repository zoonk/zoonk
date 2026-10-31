"use client";

import {
  type MotionDuration,
  type MotionEasing,
  readDuration,
  readEasing,
} from "@zoonk/ui/lib/motion";
import { useEffect, useRef, useState } from "react";
import { useReducedPreview } from "./motion-preview";

const SAMPLES = 48;

const WIDTH = 160;
const HEIGHT = 80;
const OVERSHOOT_ROOM = 0.15;
const TRAVEL_PX = 136;

/** Reads a paused animation's eased progress at each step, so the plot is the token itself. */
function sampleEasing(element: Element, easing: string): number[] {
  const probe = element.animate([], { duration: 1000, easing, fill: "both" });
  probe.pause();

  const values = Array.from({ length: SAMPLES + 1 }, (_, index) => {
    probe.currentTime = (index / SAMPLES) * 1000;
    return probe.effect?.getComputedTiming().progress ?? 0;
  });

  probe.cancel();
  return values;
}

function toY(progress: number): number {
  return HEIGHT - (progress / (1 + OVERSHOOT_ROOM)) * HEIGHT;
}

function toPath(values: readonly number[]): string {
  return values
    .map((value, index) => `${index === 0 ? "M" : "L"}${(index / SAMPLES) * WIDTH} ${toY(value)}`)
    .join(" ");
}

export function EasingCurve({
  duration,
  easing,
}: {
  duration: MotionDuration;
  easing: MotionEasing;
}) {
  const reduced = useReducedPreview();
  const plot = useRef<SVGSVGElement>(null);
  const dot = useRef<HTMLSpanElement>(null);
  const [path, setPath] = useState("");

  useEffect(() => {
    if (plot.current) {
      setPath(toPath(sampleEasing(plot.current, readEasing(plot.current, easing))));
    }
  }, [easing]);

  function play() {
    dot.current?.animate([{ translate: "0 0" }, { translate: `${TRAVEL_PX}px 0` }], {
      duration: readDuration(dot.current, duration),
      easing: readEasing(dot.current, easing),
      fill: "forwards",
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <svg
        aria-hidden="true"
        className="text-foreground overflow-visible"
        height={HEIGHT}
        ref={plot}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
      >
        <line
          className="stroke-border"
          strokeDasharray="3 3"
          x1={0}
          x2={WIDTH}
          y1={toY(1)}
          y2={toY(1)}
        />
        <line className="stroke-border" x1={0} x2={WIDTH} y1={HEIGHT} y2={HEIGHT} />
        <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} />
      </svg>

      <div className="flex items-center gap-3">
        <span className="bg-muted relative h-2 w-40 rounded-full">
          <span className="bg-foreground absolute top-0 left-0 size-2 rounded-full" ref={dot} />
        </span>
        <button
          className="text-muted-foreground hover:text-foreground hit-area relative text-xs font-medium underline-offset-2 hover:underline"
          onClick={play}
          type="button"
        >
          {reduced ? "Play (reduced)" : "Play"}
        </button>
      </div>
    </div>
  );
}

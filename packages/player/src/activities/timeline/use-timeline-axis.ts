"use client";

import { useRef } from "react";
import { snapYear } from "./timeline-scale";

/** Space above the first year and below the last, so dots and cards never touch the edges. */
const TRACK_INSET = 20;

export type TimelineAxis = { end: number; height: number; start: number };

export function yearToY(year: number, axis: TimelineAxis): number {
  const span = axis.end - axis.start || 1;
  return TRACK_INSET + ((year - axis.start) / span) * (axis.height - TRACK_INSET * 2);
}

function yToYear(y: number, axis: TimelineAxis): number {
  const share = (y - TRACK_INSET) / (axis.height - TRACK_INSET * 2);
  return snapYear(axis.start + share * (axis.end - axis.start), axis);
}

/**
 * The track's element and a way to read the year under a pointer, so events can be dropped or
 * dragged anywhere along the axis, even from outside it (pointer capture keeps a drag going).
 */
export function useTimelineAxis(axis: TimelineAxis) {
  const trackRef = useRef<HTMLDivElement>(null);

  function yearAt(event: {
    clientX: number;
    clientY: number;
  }): { inside: boolean; year: number } | null {
    const rect = trackRef.current?.getBoundingClientRect();

    if (!rect) {
      return null;
    }

    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    return { inside, year: yToYear(event.clientY - rect.top, axis) };
  }

  return { trackRef, yearAt };
}

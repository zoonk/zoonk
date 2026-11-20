"use client";

import { useRef } from "react";
import { snapYear } from "./timeline-scale";

/** `inset` is half a card's room, so a card at either end of the axis sits level with its dot. */
export type TimelineAxis = { end: number; height: number; inset: number; start: number };

export function yearToY(year: number, axis: TimelineAxis): number {
  const span = axis.end - axis.start || 1;
  return axis.inset + ((year - axis.start) / span) * (axis.height - axis.inset * 2);
}

function yToYear(y: number, axis: TimelineAxis): number {
  const share = (y - axis.inset) / (axis.height - axis.inset * 2);
  return snapYear(axis.start + share * (axis.end - axis.start), axis);
}

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

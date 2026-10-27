"use client";

import { readDuration, readEasing } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";
import { useLayoutEffect, useRef } from "react";
import { RING_VIEW_BOX, getArcPath } from "./missions-ring-arc";

/** Today's missions as the buddy's tab counts them: how many are done of how many. */
export type MissionsCount = { done: number; total: number };

/** Remembers the count the learner last saw, so a mission done since then fills with a moment. */
const SEEN_KEY = "zoonk:missions-seen";

function readSeen(): number | null {
  try {
    const value = globalThis.localStorage.getItem(SEEN_KEY);
    return value === null ? null : Number(value);
  } catch {
    return null;
  }
}

function writeSeen(done: number) {
  try {
    globalThis.localStorage.setItem(SEEN_KEY, String(done));
  } catch {
    // Without storage, every mission simply shows done, without its moment.
  }
}

/** The face's pop, after its arcs have filled: a data attribute the face's classes play. */
function popFace(face: HTMLElement) {
  face.dataset.popping = "";

  const end = (event: AnimationEvent) => {
    if (event.target === face) {
      delete face.dataset.popping;
      face.removeEventListener("animationend", end);
    }
  };

  face.addEventListener("animationend", end);
}

/**
 * Fills in the arcs of the missions done since the learner last saw the ring, in the fill's time,
 * then pops the face once: before the browser paints a new count (after hydration on a first
 * load), and not at all when the device asks for less motion, whose fill time is 0. A new day,
 * with fewer done, just starts over.
 */
function useMissionMoment({
  done,
  enabled,
  face,
  ring,
}: {
  done: number;
  enabled: boolean;
  face: React.RefObject<HTMLSpanElement | null>;
  ring: React.RefObject<SVGSVGElement | null>;
}) {
  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    const seen = readSeen();
    writeSeen(done);
    const svg = ring.current;
    const duration = svg ? readDuration(svg, "fill") : 0;

    if (!svg || seen === null || done <= seen || duration === 0) {
      return;
    }

    for (const arc of [...svg.querySelectorAll("path")].slice(seen, done)) {
      arc.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
        duration,
        easing: readEasing(svg, "out"),
        fill: "backwards",
      });
    }

    if (face.current) {
      popFace(face.current);
    }
  }, [done, enabled, face, ring]);
}

/**
 * A mission done fills its arc in the foreground's tone; the ring closes in Brain Power's violet
 * only once every mission is, one of the few moments drawn louder (the day's missions earned their
 * reward), so a part-done day doesn't read as finished.
 */
function getArcClass({ complete, done }: { complete: boolean; done: boolean }): string {
  if (!done) {
    return "stroke-foreground/15";
  }

  return complete ? "stroke-brain" : "stroke-foreground/50";
}

/**
 * Today's missions as a ring of arcs, one per mission, around the buddy's face on its tab: each
 * arc fills as its mission is done, so they're in sight on every tab without a row of their own. A
 * mission done since the learner last looked fills in with a short moment (`moment`, one ring
 * has it). Decorative: the tab's name says the count. Place the buddy's face as its child; the
 * buddy page's missions chip draws it small and empty, so the two read as the same thing.
 */
export function MissionsRing({
  children,
  className,
  missions,
  moment = true,
  strokeWidth = 2,
}: {
  children?: React.ReactNode;
  className?: string;
  missions: MissionsCount;
  moment?: boolean;
  /** In the ring's 36-unit box: thicker for a small ring, so it still reads. */
  strokeWidth?: number;
}) {
  const ring = useRef<SVGSVGElement>(null);
  const face = useRef<HTMLSpanElement>(null);
  const complete = missions.total > 0 && missions.done >= missions.total;

  useMissionMoment({ done: missions.done, enabled: moment, face, ring });

  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      data-complete={complete || undefined}
      data-slot="missions-ring"
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full overflow-visible"
        fill="none"
        ref={ring}
        viewBox={`0 0 ${RING_VIEW_BOX} ${RING_VIEW_BOX}`}
      >
        {Array.from({ length: missions.total }, (_, index) => (
          <path
            className={getArcClass({ complete, done: index < missions.done })}
            d={getArcPath({ index, total: missions.total })}
            key={index}
            pathLength={1}
            strokeDasharray="1"
            strokeLinecap="round"
            strokeWidth={strokeWidth}
          />
        ))}
      </svg>
      <span
        className="data-popping:animate-pop relative flex items-center justify-center data-popping:[animation-delay:var(--transition-duration-fill)]"
        ref={face}
      >
        {children}
      </span>
    </span>
  );
}

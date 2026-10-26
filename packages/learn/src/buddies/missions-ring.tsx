"use client";

import { getScrollBehavior } from "@zoonk/ui/lib/scroll-behavior";
import { cn } from "@zoonk/ui/lib/utils";
import { useLayoutEffect, useRef } from "react";
import { RING_VIEW_BOX, getArcPath } from "./missions-ring-arc";

/** Today's missions as the buddy's tab counts them: how many are done of how many. */
export type MissionsCount = { done: number; total: number };

/** An arc fills in, then the face inside gives a small bounce. */
const FILL_MS = 900;
const POP_MS = 300;
const POP_SCALE = 1.15;
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

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

/**
 * Fills in the arcs of the missions done since the learner last saw the ring (or since `from`, on
 * the screen of the work that did them), then bounces the face: before the browser paints a new
 * count (after hydration on a first load), and not at all when the device asks for less motion. A
 * new day, with fewer done, just starts over.
 */
function useMissionMoment({
  done,
  enabled,
  face,
  from,
  ring,
}: {
  done: number;
  enabled: boolean;
  face: React.RefObject<HTMLSpanElement | null>;
  from?: number;
  ring: React.RefObject<SVGSVGElement | null>;
}) {
  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    const seen = from ?? readSeen();
    writeSeen(done);

    if (seen === null || done <= seen || getScrollBehavior() === "auto") {
      return;
    }

    const arcs = [...(ring.current?.querySelectorAll("path") ?? [])].slice(seen, done);

    for (const arc of arcs) {
      arc.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
        duration: FILL_MS,
        easing: EASE_OUT,
        fill: "backwards",
      });
    }

    face.current?.animate(
      [{ transform: "scale(1)" }, { transform: `scale(${POP_SCALE})` }, { transform: "scale(1)" }],
      { delay: FILL_MS, duration: POP_MS, easing: "ease-out" },
    );
  }, [done, enabled, face, from, ring]);
}

/**
 * A mission done fills its arc in the foreground's tone; the ring turns green only once every
 * mission is, so green keeps meaning done and a part-done day doesn't read as finished.
 */
function getArcClass({ complete, done }: { complete: boolean; done: boolean }): string {
  if (!done) {
    return "stroke-foreground/15";
  }

  return complete ? "stroke-success" : "stroke-foreground/50";
}

/**
 * Today's missions as a ring of arcs, one per mission, around the buddy's face on its tab: each
 * arc fills as its mission is done, so they're in sight on every tab without a row of their own. A
 * mission done since the learner last looked fills in with a short moment (`moment`, one ring
 * has it), or, on the screen of the work that did them, since `from`, so the learner sees it there
 * and the tab doesn't play it again. Decorative: the tab's name says the count. Place the buddy's
 * face as its child; the buddy page's missions chip draws it small and empty, so the two read as
 * the same thing.
 */
export function MissionsRing({
  children,
  className,
  from,
  missions,
  moment = true,
  strokeWidth = 2,
}: {
  children?: React.ReactNode;
  className?: string;
  /** How many were done before the work this screen ends, so their arcs fill from there now. */
  from?: number;
  missions: MissionsCount;
  moment?: boolean;
  /** In the ring's 36-unit box: thicker for a small ring, so it still reads. */
  strokeWidth?: number;
}) {
  const ring = useRef<SVGSVGElement>(null);
  const face = useRef<HTMLSpanElement>(null);
  const complete = missions.total > 0 && missions.done >= missions.total;

  useMissionMoment({ done: missions.done, enabled: moment, face, from, ring });

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
      <span className="relative flex items-center justify-center" ref={face}>
        {children}
      </span>
    </span>
  );
}

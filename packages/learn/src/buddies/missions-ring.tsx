"use client";

import { getScrollBehavior } from "@zoonk/ui/lib/scroll-behavior";
import { cn } from "@zoonk/ui/lib/utils";
import { useLayoutEffect, useRef } from "react";

/** Today's missions as the buddy's tab counts them: how many are done of how many. */
export type MissionsCount = { done: number; total: number };

const VIEW_BOX = 36;
const CENTER = VIEW_BOX / 2;
const RADIUS = 17;
const FULL_TURN = 360;
const GAP_DEGREES = 22;
const START_DEGREES = -90;

/** Rounded, so the server's path and the browser's are the same text. */
const POINT_DIGITS = 3;

/** An arc fills in, then the face inside gives a small bounce. */
const FILL_MS = 900;
const POP_MS = 300;
const POP_SCALE = 1.15;
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Remembers the count the learner last saw, so a mission done since then fills with a moment. */
const SEEN_KEY = "zoonk:missions-seen";

function toPoint(degrees: number) {
  const radians = (degrees * Math.PI) / (FULL_TURN / 2);
  const x = CENTER + RADIUS * Math.cos(radians);
  const y = CENTER + RADIUS * Math.sin(radians);

  return `${x.toFixed(POINT_DIGITS)} ${y.toFixed(POINT_DIGITS)}`;
}

/** One mission's arc of the ring, clockwise from the top with a gap between missions. */
function getArcPath(index: number, total: number): string {
  const span = FULL_TURN / total;
  const start = START_DEGREES + index * span + GAP_DEGREES / 2;
  const end = start + span - GAP_DEGREES;

  return `M ${toPoint(start)} A ${RADIUS} ${RADIUS} 0 0 1 ${toPoint(end)}`;
}

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
 * Fills in the arcs of the missions done since the learner last saw the ring, then bounces the
 * face: before the browser paints a new count (after hydration on a first load), and not at all
 * when the device asks for less motion. A new day, with fewer done, just starts over.
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
  }, [done, enabled, face, ring]);
}

/**
 * Today's three missions as a ring of three arcs around the buddy's face on its tab: each arc
 * fills as its mission is done, so they're in sight on every tab without a row of their own. A
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
        viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`}
      >
        {Array.from({ length: missions.total }, (_, index) => (
          <path
            className={index < missions.done ? "stroke-success" : "stroke-foreground/15"}
            d={getArcPath(index, missions.total)}
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

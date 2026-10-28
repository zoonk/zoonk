"use client";

import { readDuration, readEasing } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";
import { useLayoutEffect, useRef } from "react";
import { deviceStorage } from "../_utils/device-storage";
import { RING_VIEW_BOX, getArcPath } from "./missions-ring-arc";

export type MissionsCount = { done: number; total: number };

const SEEN_KEY = "zoonk:missions-seen";

function useMissionMoment({
  done,
  enabled,
  ring,
}: {
  done: number;
  enabled: boolean;
  ring: React.RefObject<SVGSVGElement | null>;
}) {
  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    const seen = deviceStorage.get(SEEN_KEY);
    deviceStorage.set(SEEN_KEY, String(done));
    const svg = ring.current;
    const duration = svg ? readDuration(svg, "fill") : 0;

    if (!svg || seen === null || done <= Number(seen) || duration === 0) {
      return;
    }

    for (const arc of [...svg.querySelectorAll("path")].slice(Number(seen), done)) {
      arc.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
        duration,
        easing: readEasing(svg, "out"),
        fill: "backwards",
      });
    }
  }, [done, enabled, ring]);
}

function getArcClass({ complete, done }: { complete: boolean; done: boolean }): string {
  if (!done) {
    return "stroke-foreground/15";
  }

  return complete ? "stroke-brain" : "stroke-foreground/50";
}

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
  /** In the ring's 36-unit box. */
  strokeWidth?: number;
}) {
  const ring = useRef<SVGSVGElement>(null);
  const complete = missions.total > 0 && missions.done >= missions.total;

  useMissionMoment({ done: missions.done, enabled: moment, ring });

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
      <span className="relative flex items-center justify-center">{children}</span>
    </span>
  );
}

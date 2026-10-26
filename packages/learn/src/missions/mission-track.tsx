"use client";

import { type Mission } from "@zoonk/core/sessions/missions";
import { cn } from "@zoonk/ui/lib/utils";
import { useEffect, useState } from "react";

/** How far a mission is, from 0 to 1, for its segment of the day's track. */
function getFill(mission: Pick<Mission, "done" | "total">): number {
  return mission.total > 0 ? Math.min(1, mission.done / mission.total) : 0;
}

/** The furthest missions first, so the track fills from its start in whatever order they're listed. */
function byFurthest(fills: number[]): number[] {
  return fills.toSorted((first, second) => second - first);
}

/**
 * The day's missions as one track in Brain Power's violet, drawn as a meter's parts (6px, 2px
 * apart), a segment per mission filled as far as it is ("1 of 3 fixed" fills a third), the
 * furthest first: "1 of 2" fills the first segment even
 * when the mission done is listed last. Given where the missions stood before (`from`), it starts
 * there and fills to now: the one animation missions have, right after the action that moved them.
 * Decorative: the words beside it say the same.
 */
export function MissionTrack({
  className,
  from,
  missions,
}: {
  className?: string;
  from?: readonly Pick<Mission, "done" | "kind" | "total">[];
  missions: readonly Pick<Mission, "done" | "kind" | "total">[];
}) {
  const target = byFurthest(missions.map((mission) => getFill(mission)));

  const [fills, setFills] = useState(() =>
    byFurthest(
      missions.map((mission) => {
        const before = from?.find((candidate) => candidate.kind === mission.kind);
        return before ? getFill(before) : getFill(mission);
      }),
    ),
  );

  const targetKey = target.join(",");

  useEffect(() => {
    // The next frame, so the segments paint where they were before filling to where they are.
    const frame = requestAnimationFrame(() => setFills(targetKey.split(",").map(Number)));
    return () => cancelAnimationFrame(frame);
  }, [targetKey]);

  return (
    <div aria-hidden="true" className={cn("flex gap-0.5", className)} data-slot="mission-track">
      {missions.map((mission, index) => (
        <span
          className="bg-brain/15 dark:bg-brain/30 relative h-1.5 flex-1 overflow-hidden rounded-[3px]"
          key={mission.kind}
        >
          <span
            className="bg-brain absolute inset-y-0 left-0 transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${(fills[index] ?? 0) * 100}%` }}
          />
        </span>
      ))}
    </div>
  );
}

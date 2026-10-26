import { type Mission } from "@zoonk/core/sessions/missions";
import { cn } from "@zoonk/ui/lib/utils";

/** How far a mission is, from 0 to 1, for its segment of the day's track. */
function getFill(mission: Pick<Mission, "done" | "total">): number {
  return mission.total > 0 ? Math.min(1, mission.done / mission.total) : 0;
}

/**
 * The day's missions as one track in Brain Power's violet, a segment per mission filled as far as
 * it is ("1 of 3 fixed" fills a third), the furthest first: "1 of 2" fills the first segment even
 * when the mission done is listed last; a segment fills to where its mission moves while in view.
 * Decorative: the words beside it say the same.
 */
export function MissionTrack({
  className,
  missions,
}: {
  className?: string;
  missions: readonly Pick<Mission, "done" | "kind" | "total">[];
}) {
  const fills = missions
    .map((mission) => getFill(mission))
    .toSorted((first, second) => second - first);

  return (
    <div aria-hidden="true" className={cn("flex gap-1", className)} data-slot="mission-track">
      {missions.map((mission, index) => (
        <span
          className="bg-brain/15 dark:bg-brain/30 relative h-1.5 flex-1 rounded-full"
          key={mission.kind}
        >
          <span
            className="bg-brain absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${(fills[index] ?? 0) * 100}%` }}
          />
        </span>
      ))}
    </div>
  );
}

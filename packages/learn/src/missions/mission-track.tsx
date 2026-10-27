import { type Mission } from "@zoonk/core/sessions/missions";
import { type CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";
import { STAGGER_MS } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";

type TrackMission = Pick<Mission, "done" | "kind" | "total">;

/** How far a mission is, from 0 to 1, for its segment of the day's track. */
function getFill(mission: Pick<Mission, "done" | "total">): number {
  return mission.total > 0 ? Math.min(1, mission.done / mission.total) : 0;
}

/** The furthest missions first, so the track fills from its start in whatever order they're listed. */
function byFurthest(fills: number[]): number[] {
  return fills.toSorted((first, second) => second - first);
}

/**
 * A segment that moved fills from where it was: its fill starts at that share of its own length
 * (`--fill-from`), on its turn after `delay`, the ones that moved a stagger apart.
 */
function getFillMotion({
  delay,
  fill,
  order,
  was,
}: {
  delay: number;
  fill: number;
  order: number;
  was: number;
}): CSSPropertiesWithVariables {
  return { "--fill-from": was / fill, animationDelay: `${delay + order * STAGGER_MS}ms` };
}

/**
 * The day's missions as one track in Brain Power's violet, drawn as a meter's parts (6px, 2px
 * apart), a segment per mission filled as far as it is ("1 of 3 fixed" fills a third), the
 * furthest first: "1 of 2" fills the first segment even
 * when the mission done is listed last. Given where the missions stood before (`from`), the
 * segments that moved fill from there to now after `delay`: the one animation missions have, right
 * after the action that moved them. Decorative: the words beside it say the same.
 */
export function MissionTrack({
  className,
  delay = 0,
  from,
  missions,
}: {
  className?: string;
  delay?: number;
  from?: readonly TrackMission[];
  missions: readonly TrackMission[];
}) {
  const fills = byFurthest(missions.map((mission) => getFill(mission)));

  const before = byFurthest(
    missions.map((mission) => {
      const was = from?.find((candidate) => candidate.kind === mission.kind);
      return was ? getFill(was) : getFill(mission);
    }),
  );

  const moved = fills.map((fill, index) => fill > (before[index] ?? fill));

  return (
    <div aria-hidden="true" className={cn("flex gap-0.5", className)} data-slot="mission-track">
      {missions.map((mission, index) => {
        const fill = fills[index] ?? 0;

        return (
          <span
            className="bg-brain/15 dark:bg-brain/30 relative h-1.5 flex-1 overflow-hidden rounded-[3px]"
            key={mission.kind}
          >
            <span
              className={cn(
                "bg-brain absolute inset-y-0 left-0",
                moved[index] && "animate-fill origin-left",
              )}
              style={{
                width: `${fill * 100}%`,
                ...(moved[index] &&
                  getFillMotion({
                    delay,
                    fill,
                    order: moved.slice(0, index).filter(Boolean).length,
                    was: before[index] ?? 0,
                  })),
              }}
            />
          </span>
        );
      })}
    </div>
  );
}

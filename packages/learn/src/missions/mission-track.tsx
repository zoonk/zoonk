import { type Mission } from "@zoonk/core/sessions/missions";
import { type CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";
import { STAGGER_MS } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";

type TrackMission = Pick<Mission, "done" | "kind" | "total">;

function getFill(mission: Pick<Mission, "done" | "total">): number {
  return mission.total > 0 ? Math.min(1, mission.done / mission.total) : 0;
}

function byFurthest(fills: number[]): number[] {
  return fills.toSorted((first, second) => second - first);
}

function getFillMotion({
  delayMs,
  fill,
  order,
  was,
}: {
  delayMs: number;
  fill: number;
  order: number;
  was: number;
}): CSSPropertiesWithVariables {
  return { "--fill-from": was / fill, animationDelay: `${delayMs + order * STAGGER_MS}ms` };
}

export function MissionTrack({
  className,
  delayMs = 0,
  from,
  missions,
}: {
  className?: string;
  delayMs?: number;
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
                    delayMs,
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

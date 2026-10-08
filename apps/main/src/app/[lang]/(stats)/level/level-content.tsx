import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getSession } from "@zoonk/core/users/session";
import { Surface } from "@zoonk/learn/surface";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { LevelProgression, LevelProgressionSkeleton } from "./level-progression";
import { LevelLine, LevelStats, LevelStatsSkeleton } from "./level-stats";

/** Level: the belt and level, how far the next one is, the belts ahead, and one line. */
export async function LevelContent() {
  const [currentBelt, session] = await Promise.all([getBeltLevel(), getSession()]);

  if (!(currentBelt && session)) {
    return <ProgressEmptyState isAuthenticated={Boolean(session)} />;
  }

  return (
    <ProgressContent>
      <div className="px-1">
        <LevelStats currentBelt={currentBelt} />
      </div>
      <Surface className="p-4">
        <LevelProgression currentBelt={currentBelt} />
      </Surface>
      <div className="px-1">
        <LevelLine totalBrainPower={currentBelt.totalBrainPower} />
      </div>
    </ProgressContent>
  );
}

/** Preserves the Level page hierarchy while its server data is loading. */
export function LevelContentSkeleton() {
  return (
    <ProgressContent>
      <div className="px-1">
        <LevelStatsSkeleton />
      </div>
      <Surface className="p-4">
        <LevelProgressionSkeleton />
      </Surface>
      <Skeleton className="mx-1 h-4 w-72 max-w-full" />
    </ProgressContent>
  );
}

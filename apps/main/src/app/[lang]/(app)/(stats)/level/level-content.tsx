import { LearnerWitness } from "@/components/learner/learner-witness";
import { getMenu } from "@/lib/menu";
import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getSession } from "@zoonk/core/users/session";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { StatTilesSkeleton } from "../_components/stats-tiles";
import { LevelProgression, LevelProgressionSkeleton } from "./level-progression";
import { LevelLine, LevelTiles } from "./level-stats";

/** Level: its three numbers, every belt as a path, and one line on how Brain Power grows. */
export async function LevelContent() {
  const [currentBelt, session] = await Promise.all([getBeltLevel(), getSession()]);

  if (!(currentBelt && session)) {
    return (
      <>
        <LearnerWitness />
        <ProgressEmptyState isAuthenticated={Boolean(session)} next={getMenu("level").url} />
      </>
    );
  }

  return (
    <ProgressContent>
      <LearnerWitness />
      <LevelTiles level={currentBelt} />
      <LevelProgression currentBelt={currentBelt} />
      <LevelLine />
    </ProgressContent>
  );
}

/** Level at its size while its numbers load: the tiles, the belts and the line. */
export function LevelContentSkeleton() {
  return (
    <ProgressContent>
      <StatTilesSkeleton count={3} />
      <LevelProgressionSkeleton />
      <Skeleton className="h-4 w-72 max-w-full" />
    </ProgressContent>
  );
}

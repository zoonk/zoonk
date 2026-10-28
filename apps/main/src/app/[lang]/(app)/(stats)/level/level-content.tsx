import { getMenu } from "@/lib/menu";
import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getSession } from "@zoonk/core/users/session";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { StatTilesSkeleton } from "../_components/stats-tiles";
import { LevelProgression, LevelProgressionSkeleton } from "./level-progression";
import { LevelLine, LevelTiles } from "./level-stats";

export async function LevelContent() {
  const [currentBelt, session] = await Promise.all([getBeltLevel(), getSession()]);

  if (!(currentBelt && session)) {
    return <ProgressEmptyState isAuthenticated={Boolean(session)} next={getMenu("level").url} />;
  }

  return (
    <ProgressContent>
      <LevelTiles level={currentBelt} />
      <LevelProgression currentBelt={currentBelt} />
      <LevelLine />
    </ProgressContent>
  );
}

export function LevelContentSkeleton() {
  return (
    <ProgressContent>
      <StatTilesSkeleton count={3} />
      <LevelProgressionSkeleton />
      <Skeleton className="h-4 w-72 max-w-full" />
    </ProgressContent>
  );
}

import { getMenu } from "@/lib/menu";
import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getSession } from "@zoonk/core/users/session";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { LevelProgression, LevelProgressionSkeleton } from "./level-progression";

export async function LevelContent() {
  const [currentBelt, session] = await Promise.all([getBeltLevel(), getSession()]);

  if (!(currentBelt && session)) {
    return <ProgressEmptyState isAuthenticated={Boolean(session)} next={getMenu("level").url} />;
  }

  return (
    <ProgressContent>
      <LevelProgression currentBelt={currentBelt} />
    </ProgressContent>
  );
}

export function LevelContentSkeleton() {
  return (
    <ProgressContent>
      <LevelProgressionSkeleton />
    </ProgressContent>
  );
}

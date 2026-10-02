import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getSession } from "@zoonk/core/users/session";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { LevelExplanation, LevelExplanationSkeleton } from "./level-explanation";
import { LevelProgression, LevelProgressionSkeleton } from "./level-progression";
import { LevelStats, LevelStatsSkeleton } from "./level-stats";

/** Loads only the durable progress and identity needed to explain the learner's level. */
export async function LevelContent() {
  const [currentBelt, session] = await Promise.all([getBeltLevel(), getSession()]);

  const isAuthenticated = Boolean(session);

  if (!(currentBelt && isAuthenticated)) {
    return (
      <ProgressEmptyState isAuthenticated={isAuthenticated}>
        <LevelExplanation />
      </ProgressEmptyState>
    );
  }

  return (
    <ProgressContent>
      <LevelStats currentBelt={currentBelt} />
      <LevelProgression currentBelt={currentBelt} />
      <LevelExplanation />
    </ProgressContent>
  );
}

/** Preserves the simplified Level page hierarchy while its server data is loading. */
export function LevelContentSkeleton() {
  return (
    <ProgressContent>
      <LevelStatsSkeleton />
      <LevelProgressionSkeleton />
      <LevelExplanationSkeleton />
    </ProgressContent>
  );
}

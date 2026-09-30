import { loadOptionalData } from "@/data/_utils/load-optional-data";
import { getCurrentUserScorePatterns } from "@zoonk/core/progress/get-score-patterns";
import { getSession } from "@zoonk/core/users/session";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { DayRhythm } from "./day-rhythm";
import { WeekdayRhythm } from "./weekday-rhythm";

/**
 * Loads both independent pattern dimensions with authentication context, then
 * gives each compact visualization the complete stable set of categories.
 */
export async function PatternsContent() {
  const [resource, session] = await Promise.all([
    loadOptionalData(getCurrentUserScorePatterns),
    getSession(),
  ]);

  const isAuthenticated = Boolean(session);
  const patterns = resource?.patterns;

  if (!(patterns && isAuthenticated)) {
    return <ProgressEmptyState isAuthenticated={isAuthenticated}>{null}</ProgressEmptyState>;
  }

  return (
    <ProgressContent>
      <WeekdayRhythm
        patterns={patterns.weekdays}
        strongestDayOfWeek={patterns.strongestWeekday?.dayOfWeek ?? null}
      />
      <DayRhythm
        patterns={patterns.times}
        strongestPeriod={patterns.strongestTime?.period ?? null}
      />
    </ProgressContent>
  );
}

/** Mirrors the two compact rhythm sections while private pattern data streams. */
export function PatternsContentSkeleton() {
  return (
    <ProgressContent aria-hidden="true">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-14 w-72 max-w-full rounded-xl" />
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </ProgressContent>
  );
}

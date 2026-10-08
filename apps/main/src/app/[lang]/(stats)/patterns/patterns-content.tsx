import { loadOptionalData } from "@/data/_utils/load-optional-data";
import { getCurrentUserScorePatterns } from "@zoonk/core/progress/get-score-patterns";
import { getSession } from "@zoonk/core/users/session";
import { Surface } from "@zoonk/learn/surface";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { DayRhythm } from "./day-rhythm";
import { WeekdayRhythm } from "./weekday-rhythm";

/** Patterns: the weekly rhythm, opening on the strongest day, then the best parts of the day. */
export async function PatternsContent() {
  const [resource, session, t] = await Promise.all([
    loadOptionalData(getCurrentUserScorePatterns),
    getSession(),
    getExtracted(),
  ]);

  const patterns = resource?.patterns;

  if (!(patterns && session)) {
    return <ProgressEmptyState isAuthenticated={Boolean(session)} />;
  }

  return (
    <ProgressContent>
      <div className="flex flex-col gap-3">
        <h2 className="px-1 font-semibold tracking-tight">{t("Throughout the week")}</h2>
        <Surface className="p-4">
          <WeekdayRhythm
            patterns={patterns.weekdays}
            strongestDayOfWeek={patterns.strongestWeekday?.dayOfWeek ?? null}
          />
        </Surface>
      </div>

      <DayRhythm
        patterns={patterns.times}
        strongestPeriod={patterns.strongestTime?.period ?? null}
      />
    </ProgressContent>
  );
}

/** Mirrors the weekly rhythm and the four parts of the day while private pattern data streams. */
export function PatternsContentSkeleton() {
  return (
    <ProgressContent aria-hidden="true">
      <div className="flex flex-col gap-3">
        <Skeleton className="mx-1 h-5 w-36" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="mx-1 h-5 w-40" />
        <Skeleton className="h-60 w-full rounded-2xl" />
      </div>
    </ProgressContent>
  );
}

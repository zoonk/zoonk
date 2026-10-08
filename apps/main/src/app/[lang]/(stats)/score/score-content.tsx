import { loadOptionalData } from "@/data/_utils/load-optional-data";
import { getScoreHistory } from "@zoonk/core/progress/get-score-history";
import { getSession } from "@zoonk/core/users/session";
import { Surface } from "@zoonk/learn/surface";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getLocale } from "next-intl/server";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { ScoreChart, ScoreChartSkeleton } from "./score-chart";
import { ScoreLine, ScoreStats, ScoreStatsSkeleton } from "./score-stats";

/** Score: the 90-day accuracy, its weekly trend and one line on what moves it. */
export async function ScoreContent() {
  const locale = await getLocale();

  const [history, session] = await Promise.all([
    loadOptionalData(() => getScoreHistory({ locale })),
    getSession(),
  ]);

  if (!(history && session)) {
    return <ProgressEmptyState isAuthenticated={Boolean(session)} />;
  }

  return (
    <ProgressContent>
      <div className="px-1">
        <ScoreStats performance={history} />
      </div>
      <Surface className="p-4">
        <ScoreChart dataPoints={history.dataPoints} performance={history} />
      </Surface>
      <div className="px-1">
        <ScoreLine />
      </div>
    </ProgressContent>
  );
}

/** Mirrors every final Score section while the private rolling data streams. */
export function ScoreContentSkeleton() {
  return (
    <ProgressContent>
      <div className="px-1">
        <ScoreStatsSkeleton />
      </div>
      <Surface className="p-4">
        <ScoreChartSkeleton />
      </Surface>
      <Skeleton className="mx-1 h-4 w-72 max-w-full" />
    </ProgressContent>
  );
}

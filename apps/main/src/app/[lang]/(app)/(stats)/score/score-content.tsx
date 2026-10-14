import { loadOptionalData } from "@/data/_utils/load-optional-data";
import { getMenu } from "@/lib/menu";
import { getScoreHistory } from "@zoonk/core/progress/get-score-history";
import { getSession } from "@zoonk/core/users/session";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getLocale } from "next-intl/server";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { StatTilesSkeleton } from "../_components/stats-tiles";
import { LazyScoreChartPlot } from "./lazy-score-chart-plot";
import { ScoreChart, ScoreChartSkeleton } from "./score-chart";
import { ScoreLine, ScoreTiles } from "./score-stats";

/** Score: its three numbers, its weekly trend and one line on what moves it. */
export async function ScoreContent() {
  const locale = await getLocale();

  const [history, session] = await Promise.all([
    loadOptionalData(() => getScoreHistory({ locale })),
    getSession(),
  ]);

  if (!(history && session)) {
    return <ProgressEmptyState isAuthenticated={Boolean(session)} next={getMenu("score").url} />;
  }

  return (
    <ProgressContent>
      <ScoreTiles performance={history} />
      <ScoreChart dataPoints={history.dataPoints} performance={history} plot={LazyScoreChartPlot} />
      <ScoreLine />
    </ProgressContent>
  );
}

/** Score at its size while its answers load: the tiles, the trend and the line. */
export function ScoreContentSkeleton() {
  return (
    <ProgressContent>
      <StatTilesSkeleton count={3} />
      <ScoreChartSkeleton />
      <Skeleton className="h-4 w-72 max-w-full" />
    </ProgressContent>
  );
}

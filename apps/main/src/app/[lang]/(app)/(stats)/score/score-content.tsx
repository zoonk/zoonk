import { loadOptionalData } from "@/data/_utils/load-optional-data";
import { getAppLocale } from "@/i18n/locale";
import { getMenu } from "@/lib/menu";
import { getScoreHistory } from "@zoonk/core/progress/get-score-history";
import { getSession } from "@zoonk/core/users/session";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { StatTilesSkeleton } from "../_components/stats-tiles";
import { ScoreChart, ScoreChartSkeleton } from "./score-chart";
import { ScoreTile } from "./score-stats";

export async function ScoreContent() {
  const locale = await getAppLocale();

  const [history, session] = await Promise.all([
    loadOptionalData(() => getScoreHistory({ locale })),
    getSession(),
  ]);

  if (!(history && session)) {
    return <ProgressEmptyState isAuthenticated={Boolean(session)} next={getMenu("score").url} />;
  }

  return (
    <ProgressContent>
      <ScoreTile performance={history} />
      <ScoreChart dataPoints={history.dataPoints} performance={history} />
    </ProgressContent>
  );
}

export function ScoreContentSkeleton() {
  return (
    <ProgressContent>
      <StatTilesSkeleton count={1} />
      <ScoreChartSkeleton />
    </ProgressContent>
  );
}
